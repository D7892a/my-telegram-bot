import math
import os
import secrets
import sqlite3
import threading
from datetime import datetime, timedelta, timezone
from functools import wraps
from pathlib import Path

from flask import Flask, jsonify, render_template, request, session, send_file
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename
import telebot

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "dijla_ride.db")
BOT_TOKEN = os.environ.get("BOT_TOKEN")
DRIVER_CHAT_ID = os.environ.get("DRIVER_CHAT_ID")
bot = telebot.TeleBot(BOT_TOKEN) if BOT_TOKEN else None

app = Flask(__name__)
app.config.update(
    SECRET_KEY=os.environ.get("SECRET_KEY", "dev-only-change-this-secret"),
    MAX_CONTENT_LENGTH=16 * 1024 * 1024,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
)
UPLOAD_DIR = Path(BASE_DIR) / "private_uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
ALLOWED_UPLOADS = {"jpg", "jpeg", "png", "webp", "pdf"}

STATUS_LABELS = {
    "pending": "بانتظار سائق",
    "accepted": "تم قبول الطلب",
    "arriving": "السائق بالطريق",
    "in_trip": "الرحلة جارية",
    "completed": "مكتملة",
    "cancelled": "ملغاة",
}
VALID_STATUSES = set(STATUS_LABELS)


def db_connection():
    connection = sqlite3.connect(DB_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    return connection


def init_db():
    with db_connection() as db:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS drivers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                phone TEXT NOT NULL,
                car TEXT NOT NULL,
                plate TEXT NOT NULL,
                rating REAL NOT NULL DEFAULT 5,
                online INTEGER NOT NULL DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                phone TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'customer',
                status TEXT NOT NULL DEFAULT 'active',
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS driver_applications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL UNIQUE,
                governorate TEXT NOT NULL,
                license_number TEXT NOT NULL,
                vehicle_number TEXT NOT NULL,
                vehicle_name TEXT NOT NULL,
                vehicle_color TEXT NOT NULL,
                id_card_path TEXT NOT NULL,
                license_path TEXT NOT NULL,
                vehicle_doc_path TEXT NOT NULL,
                selfie_path TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                review_notes TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                reviewed_at TEXT,
                FOREIGN KEY(user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS rides (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                rider_name TEXT NOT NULL,
                phone TEXT NOT NULL,
                pickup_name TEXT NOT NULL,
                pickup_lat REAL NOT NULL,
                pickup_lng REAL NOT NULL,
                dropoff_name TEXT NOT NULL,
                dropoff_lat REAL NOT NULL,
                dropoff_lng REAL NOT NULL,
                car_type TEXT NOT NULL DEFAULT 'economy',
                notes TEXT DEFAULT '',
                distance_km REAL NOT NULL,
                price INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                driver_id INTEGER,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(driver_id) REFERENCES drivers(id)
            );

            CREATE TABLE IF NOT EXISTS ride_ratings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ride_id INTEGER NOT NULL UNIQUE,
                user_id INTEGER NOT NULL,
                driver_id INTEGER,
                stars INTEGER NOT NULL CHECK(stars BETWEEN 1 AND 5),
                comment TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                FOREIGN KEY(ride_id) REFERENCES rides(id)
            );
            """
        )
        # Lightweight migrations for databases created by earlier versions.
        ride_columns = {row["name"] for row in db.execute("PRAGMA table_info(rides)").fetchall()}
        if "user_id" not in ride_columns:
            db.execute("ALTER TABLE rides ADD COLUMN user_id INTEGER")
        driver_columns = {row["name"] for row in db.execute("PRAGMA table_info(drivers)").fetchall()}
        if "user_id" not in driver_columns:
            db.execute("ALTER TABLE drivers ADD COLUMN user_id INTEGER")

        # The owner account is bootstrapped from environment variables. Local demo
        # values must be changed before a public deployment.
        admin_phone = os.environ.get("ADMIN_PHONE", "07800000000")
        admin_password = os.environ.get("ADMIN_PASSWORD", "Admin123!")
        admin_exists = db.execute("SELECT id FROM users WHERE role = 'admin'").fetchone()
        if not admin_exists:
            db.execute(
                "INSERT INTO users(name, phone, password_hash, role, status, created_at) VALUES (?, ?, ?, 'admin', 'active', ?)",
                ("مالك دجلة رايد", admin_phone, generate_password_hash(admin_password), datetime.now(timezone.utc).isoformat()),
            )

        driver_count = db.execute("SELECT COUNT(*) AS count FROM drivers").fetchone()["count"]
        if not driver_count:
            db.executemany(
                "INSERT INTO drivers(name, phone, car, plate, rating, online) VALUES (?, ?, ?, ?, ?, ?)",
                [
                    ("حيدر جاسم", "0780 123 4567", "تويوتا كورولا 2022", "ذي قار 21 أ 4589", 4.9, 1),
                    ("علي كريم", "0771 804 2210", "كيا سيراتو 2021", "ذي قار 18 ب 7214", 4.8, 1),
                    ("مرتضى حسن", "0750 622 1930", "هيونداي إلنترا 2020", "ذي قار 24 ج 3108", 4.7, 0),
                ],
            )
        db.commit()


def haversine(lat1, lng1, lat2, lng2):
    radius = 6371
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lng2 - lng1)
    value = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    return radius * 2 * math.atan2(math.sqrt(value), math.sqrt(1 - value))


def fare_for(distance, car_type):
    multipliers = {"economy": 1, "comfort": 1.3, "family": 1.55}
    multiplier = multipliers.get(car_type, 1)
    # 2,000 د.ع فتح عداد + 700 د.ع/كم، مقرب إلى أقرب 250
    raw_fare = max(3000, (2000 + distance * 700) * multiplier)
    return int(round(raw_fare / 250) * 250)


def ride_to_dict(row):
    ride = dict(row)
    ride["status_label"] = STATUS_LABELS.get(ride["status"], ride["status"])
    return ride


def current_user():
    user_id = session.get("user_id")
    if not user_id:
        return None
    with db_connection() as db:
        row = db.execute(
            "SELECT id, name, phone, role, status, created_at FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
    return dict(row) if row else None


def login_required(role=None):
    def decorator(function):
        @wraps(function)
        def wrapped(*args, **kwargs):
            user = current_user()
            if not user:
                return jsonify(error="يجب تسجيل الدخول أولاً"), 401
            if user["status"] != "active":
                return jsonify(error="الحساب موقوف، راجع الإدارة"), 403
            if role and user["role"] != role:
                return jsonify(error="ليس لديك صلاحية لهذا القسم"), 403
            return function(*args, **kwargs)
        return wrapped
    return decorator


def normalize_phone(phone):
    return "".join(character for character in str(phone) if character.isdigit())


def save_private_upload(file, label, user_id, image_only=False):
    if not file or not file.filename:
        raise ValueError(f"يرجى رفع {label}")
    extension = secure_filename(file.filename).rsplit(".", 1)[-1].lower()
    allowed = {"jpg", "jpeg", "png", "webp"} if image_only else ALLOWED_UPLOADS
    if extension not in allowed:
        raise ValueError(f"صيغة ملف {label} غير مدعومة")
    user_dir = UPLOAD_DIR / str(user_id)
    user_dir.mkdir(exist_ok=True)
    filename = f"{secrets.token_hex(10)}.{extension}"
    destination = user_dir / filename
    file.save(destination)
    return str(destination.relative_to(UPLOAD_DIR))


def notify_drivers(ride_id, data, price):
    if not bot or not DRIVER_CHAT_ID:
        return
    text = (
        f"🚕 طلب جديد #{ride_id}\n"
        f"👤 {data['rider_name']} — {data['phone']}\n"
        f"📍 من: {data['pickup_name']}\n"
        f"🏁 إلى: {data['dropoff_name']}\n"
        f"💵 الأجرة التقديرية: {price:,} د.ع"
    )
    try:
        bot.send_message(DRIVER_CHAT_ID, text)
    except Exception as exc:
        app.logger.warning("Telegram notification failed: %s", exc)


@app.get("/")
def home():
    return render_template("index.html")


@app.get("/owner")
def owner_dashboard():
    return render_template("owner.html")


@app.get("/api/auth/me")
def auth_me():
    user = current_user()
    if not user:
        return jsonify(authenticated=False)
    if user["role"] == "driver":
        with db_connection() as db:
            application = db.execute(
                "SELECT status, review_notes FROM driver_applications WHERE user_id = ?",
                (user["id"],),
            ).fetchone()
        user["driver_application"] = dict(application) if application else None
    return jsonify(authenticated=True, user=user)


@app.post("/api/auth/register")
def auth_register():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()
    phone = normalize_phone(data.get("phone", ""))
    password = str(data.get("password", ""))
    if len(name) < 2 or len(phone) < 10:
        return jsonify(error="يرجى كتابة الاسم ورقم هاتف عراقي صحيح"), 400
    if len(password) < 8:
        return jsonify(error="كلمة السر يجب أن تكون 8 أحرف على الأقل"), 400
    now = datetime.now(timezone.utc).isoformat()
    try:
        with db_connection() as db:
            cursor = db.execute(
                "INSERT INTO users(name, phone, password_hash, role, status, created_at) VALUES (?, ?, ?, 'customer', 'active', ?)",
                (name[:80], phone, generate_password_hash(password), now),
            )
            db.commit()
            session.clear()
            session["user_id"] = cursor.lastrowid
    except sqlite3.IntegrityError:
        return jsonify(error="رقم الهاتف مسجل مسبقاً، سجل الدخول بدلاً من ذلك"), 409
    return jsonify(message="تم إنشاء الحساب", user={"id": cursor.lastrowid, "name": name, "phone": phone, "role": "customer"}), 201


@app.post("/api/auth/login")
def auth_login():
    data = request.get_json(silent=True) or {}
    phone = normalize_phone(data.get("phone", ""))
    with db_connection() as db:
        user = db.execute("SELECT * FROM users WHERE phone = ?", (phone,)).fetchone()
    if not user or not check_password_hash(user["password_hash"], str(data.get("password", ""))):
        return jsonify(error="رقم الهاتف أو كلمة السر غير صحيحة"), 401
    if user["status"] != "active":
        return jsonify(error="هذا الحساب موقوف من الإدارة"), 403
    session.clear()
    session["user_id"] = user["id"]
    return jsonify(message="تم تسجيل الدخول", user={"id": user["id"], "name": user["name"], "phone": user["phone"], "role": user["role"]})


@app.post("/api/auth/logout")
def auth_logout():
    session.clear()
    return jsonify(message="تم تسجيل الخروج")


@app.post("/api/driver-applications")
def submit_driver_application():
    name = str(request.form.get("name", "")).strip()
    phone = normalize_phone(request.form.get("phone", ""))
    password = str(request.form.get("password", ""))
    fields = {key: str(request.form.get(key, "")).strip() for key in ["governorate", "license_number", "vehicle_number", "vehicle_name", "vehicle_color"]}
    if len(name) < 2 or len(phone) < 10 or any(not value for value in fields.values()):
        return jsonify(error="يرجى إكمال جميع معلومات السائق والسيارة"), 400
    if len(password) < 8:
        return jsonify(error="كلمة السر يجب أن تكون 8 أحرف على الأقل"), 400
    now = datetime.now(timezone.utc).isoformat()
    saved_paths = []
    try:
        with db_connection() as db:
            existing = db.execute("SELECT id, role FROM users WHERE phone = ?", (phone,)).fetchone()
            if existing:
                return jsonify(error="رقم الهاتف مسجل مسبقاً"), 409
            cursor = db.execute(
                "INSERT INTO users(name, phone, password_hash, role, status, created_at) VALUES (?, ?, ?, 'driver', 'active', ?)",
                (name[:80], phone, generate_password_hash(password), now),
            )
            user_id = cursor.lastrowid
            for key, label in [("id_card", "الهوية"), ("license", "إجازة السوق"), ("vehicle_doc", "مستمسك السيارة"), ("selfie", "الصورة الحية")]:
                saved_paths.append(save_private_upload(request.files.get(key), label, user_id, image_only=key == "selfie"))
            db.execute(
                """INSERT INTO driver_applications(
                    user_id, governorate, license_number, vehicle_number, vehicle_name, vehicle_color,
                    id_card_path, license_path, vehicle_doc_path, selfie_path, status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)""",
                (user_id, fields["governorate"], fields["license_number"], fields["vehicle_number"], fields["vehicle_name"], fields["vehicle_color"], *saved_paths, now),
            )
            db.commit()
            session.clear()
            session["user_id"] = user_id
    except ValueError as error:
        for relative_path in saved_paths:
            (UPLOAD_DIR / relative_path).unlink(missing_ok=True)
        return jsonify(error=str(error)), 400
    except sqlite3.IntegrityError:
        return jsonify(error="يوجد طلب سابق مرتبط بهذا الرقم"), 409
    return jsonify(message="تم إرسال طلبك للإدارة", status="pending"), 201


@app.get("/health")
def health():
    return jsonify(status="ok", service="Dijla Ride")


@app.get("/api/admin/driver-applications")
@login_required("admin")
def admin_driver_applications():
    with db_connection() as db:
        rows = db.execute(
            """SELECT driver_applications.*, users.name, users.phone
               FROM driver_applications JOIN users ON users.id = driver_applications.user_id
               ORDER BY CASE driver_applications.status WHEN 'pending' THEN 0 ELSE 1 END, driver_applications.id DESC"""
        ).fetchall()
    applications = []
    for row in rows:
        item = dict(row)
        for field in ["id_card_path", "license_path", "vehicle_doc_path", "selfie_path"]:
            file_format = "pdf" if item[field].lower().endswith(".pdf") else "image"
            item[field.replace("_path", "_url")] = f"/api/admin/driver-files/{item['id']}/{field}?format={file_format}"
            item.pop(field, None)
        applications.append(item)
    return jsonify(applications)


@app.get("/api/admin/driver-files/<int:application_id>/<field>")
@login_required("admin")
def admin_driver_file(application_id, field):
    allowed_fields = {"id_card_path", "license_path", "vehicle_doc_path", "selfie_path"}
    if field not in allowed_fields:
        return jsonify(error="ملف غير صحيح"), 404
    with db_connection() as db:
        row = db.execute(f"SELECT {field} AS path FROM driver_applications WHERE id = ?", (application_id,)).fetchone()
    if not row:
        return jsonify(error="الملف غير موجود"), 404
    path = (UPLOAD_DIR / row["path"]).resolve()
    if UPLOAD_DIR.resolve() not in path.parents or not path.exists():
        return jsonify(error="الملف غير موجود"), 404
    return send_file(path)


@app.patch("/api/admin/driver-applications/<int:application_id>")
@login_required("admin")
def review_driver_application(application_id):
    data = request.get_json(silent=True) or {}
    decision = data.get("status")
    if decision not in {"approved", "rejected"}:
        return jsonify(error="قرار المراجعة غير صحيح"), 400
    now = datetime.now(timezone.utc).isoformat()
    with db_connection() as db:
        application = db.execute(
            """SELECT driver_applications.*, users.name, users.phone
               FROM driver_applications JOIN users ON users.id = driver_applications.user_id
               WHERE driver_applications.id = ?""",
            (application_id,),
        ).fetchone()
        if not application:
            return jsonify(error="طلب السائق غير موجود"), 404
        db.execute(
            "UPDATE driver_applications SET status = ?, review_notes = ?, reviewed_at = ? WHERE id = ?",
            (decision, str(data.get("review_notes", ""))[:300], now, application_id),
        )
        if decision == "approved":
            existing_driver = db.execute("SELECT id FROM drivers WHERE user_id = ?", (application["user_id"],)).fetchone()
            if not existing_driver:
                db.execute(
                    "INSERT INTO drivers(name, phone, car, plate, rating, online, user_id) VALUES (?, ?, ?, ?, 5, 0, ?)",
                    (application["name"], application["phone"], f"{application['vehicle_name']} · {application['vehicle_color']}", application["vehicle_number"], application["user_id"]),
                )
        db.commit()
    return jsonify(message="تم تحديث طلب السائق", status=decision)


@app.get("/api/drivers")
def get_drivers():
    with db_connection() as db:
        rows = db.execute("SELECT * FROM drivers ORDER BY online DESC, rating DESC").fetchall()
    return jsonify([dict(row) for row in rows])


@app.get("/api/rides")
@login_required()
def get_rides():
    user = current_user()
    if user["role"] == "driver":
        with db_connection() as db:
            approved = db.execute(
                "SELECT id FROM driver_applications WHERE user_id = ? AND status = 'approved'",
                (user["id"],),
            ).fetchone()
        if not approved:
            return jsonify(error="يجب أن توافق الإدارة على حسابك قبل عرض الطلبات"), 403
    requested_status = request.args.get("status")
    query = """
        SELECT rides.*, drivers.name AS driver_name, drivers.car AS driver_car,
               drivers.plate AS driver_plate, drivers.phone AS driver_phone,
               (SELECT stars FROM ride_ratings WHERE ride_ratings.ride_id = rides.id) AS my_rating,
               (SELECT comment FROM ride_ratings WHERE ride_ratings.ride_id = rides.id) AS my_rating_comment
        FROM rides LEFT JOIN drivers ON rides.driver_id = drivers.id
    """
    conditions, params = [], []
    if user["role"] == "customer":
        conditions.append("rides.user_id = ?")
        params.append(user["id"])
    if requested_status in VALID_STATUSES:
        conditions.append("rides.status = ?")
        params.append(requested_status)
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    query += " ORDER BY rides.id DESC LIMIT 100"
    with db_connection() as db:
        rows = db.execute(query, params).fetchall()
    return jsonify([ride_to_dict(row) for row in rows])


@app.get("/api/rides/<int:ride_id>")
@login_required()
def get_ride(ride_id):
    user = current_user()
    with db_connection() as db:
        row = db.execute(
            """
            SELECT rides.*, drivers.name AS driver_name, drivers.car AS driver_car,
                   drivers.plate AS driver_plate, drivers.phone AS driver_phone,
                   drivers.rating AS driver_rating,
                   (SELECT stars FROM ride_ratings WHERE ride_ratings.ride_id = rides.id) AS my_rating,
                   (SELECT comment FROM ride_ratings WHERE ride_ratings.ride_id = rides.id) AS my_rating_comment
            FROM rides LEFT JOIN drivers ON rides.driver_id = drivers.id
            WHERE rides.id = ?
            """,
            (ride_id,),
        ).fetchone()
    if not row:
        return jsonify(error="الطلب غير موجود"), 404
    if user["role"] == "customer" and row["user_id"] != user["id"]:
        return jsonify(error="ليس لديك صلاحية لعرض هذا الطلب"), 403
    return jsonify(ride_to_dict(row))


@app.post("/api/rides/<int:ride_id>/rate")
@login_required("customer")
def rate_ride(ride_id):
    user = current_user()
    data = request.get_json(silent=True) or {}
    try:
        stars = int(data.get("stars", 0))
    except (TypeError, ValueError):
        stars = 0
    if stars not in range(1, 6):
        return jsonify(error="يرجى اختيار تقييم من نجمة إلى خمس نجوم"), 400
    comment = str(data.get("comment", "")).strip()[:300]
    with db_connection() as db:
        ride = db.execute("SELECT id, user_id, driver_id, status FROM rides WHERE id = ?", (ride_id,)).fetchone()
        if not ride:
            return jsonify(error="الطلب غير موجود"), 404
        if ride["user_id"] != user["id"]:
            return jsonify(error="ليس لديك صلاحية على هذا الطلب"), 403
        if ride["status"] != "completed":
            return jsonify(error="لا يمكن تقييم رحلة غير مكتملة"), 400
        existing = db.execute("SELECT id FROM ride_ratings WHERE ride_id = ?", (ride_id,)).fetchone()
        if existing:
            return jsonify(error="قيمت هذه الرحلة مسبقاً"), 409
        db.execute(
            "INSERT INTO ride_ratings(ride_id, user_id, driver_id, stars, comment, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (ride_id, user["id"], ride["driver_id"], stars, comment, datetime.now(timezone.utc).isoformat()),
        )
        if ride["driver_id"]:
            average = db.execute(
                "SELECT AVG(stars) AS average FROM ride_ratings WHERE driver_id = ?",
                (ride["driver_id"],),
            ).fetchone()["average"]
            if average is not None:
                db.execute("UPDATE drivers SET rating = ROUND(?, 2) WHERE id = ?", (average, ride["driver_id"]))
        db.commit()
    return jsonify(message="شكراً لتقييمك، رأيك يساعدنا على تحسين الخدمة")


@app.post("/api/rides")
@login_required()
def create_ride():
    user = current_user()
    if user["role"] != "customer":
        return jsonify(error="طلب الرحلات متاح لحسابات الزبائن فقط"), 403
    data = request.get_json(silent=True) or {}
    required = [
        "rider_name", "phone", "pickup_name", "pickup_lat", "pickup_lng",
        "dropoff_name", "dropoff_lat", "dropoff_lng",
    ]
    missing = [key for key in required if data.get(key) in (None, "")]
    if missing:
        return jsonify(error="يرجى إكمال معلومات الرحلة"), 400

    try:
        pickup_lat = float(data["pickup_lat"])
        pickup_lng = float(data["pickup_lng"])
        dropoff_lat = float(data["dropoff_lat"])
        dropoff_lng = float(data["dropoff_lng"])
    except (TypeError, ValueError):
        return jsonify(error="إحداثيات الموقع غير صحيحة"), 400

    if not (30.5 <= pickup_lat <= 32.5 and 45 <= pickup_lng <= 47.5):
        return jsonify(error="نقطة الانطلاق خارج نطاق الخدمة حالياً"), 400

    distance = round(haversine(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng) * 1.22, 1)
    car_type = data.get("car_type", "economy")
    price = fare_for(distance, car_type)
    now = datetime.now(timezone.utc).isoformat()

    with db_connection() as db:
        cursor = db.execute(
            """
            INSERT INTO rides(
                user_id, rider_name, phone, pickup_name, pickup_lat, pickup_lng,
                dropoff_name, dropoff_lat, dropoff_lng, car_type, notes,
                distance_km, price, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
            """,
            (
                user["id"], user["name"], user["phone"],
                str(data["pickup_name"]).strip()[:160], pickup_lat, pickup_lng,
                str(data["dropoff_name"]).strip()[:160], dropoff_lat, dropoff_lng,
                car_type, str(data.get("notes", "")).strip()[:300], distance, price, now, now,
            ),
        )
        db.commit()
        ride_id = cursor.lastrowid

    threading.Thread(target=notify_drivers, args=(ride_id, data, price), daemon=True).start()
    return jsonify(id=ride_id, distance_km=distance, price=price, status="pending"), 201


@app.patch("/api/rides/<int:ride_id>")
@login_required()
def update_ride(ride_id):
    user = current_user()
    if user["role"] not in {"driver", "admin", "customer"}:
        return jsonify(error="هذا الإجراء غير متاح لحسابك"), 403
    data = request.get_json(silent=True) or {}
    status = data.get("status")
    driver_id = data.get("driver_id")
    if status not in VALID_STATUSES:
        return jsonify(error="حالة الطلب غير صحيحة"), 400

    if user["role"] == "customer":
        # A customer can only cancel their own ride while it has not started yet.
        if status != "cancelled":
            return jsonify(error="تغيير حالة الرحلة متاح للسائق أو الإدارة فقط"), 403
        with db_connection() as db:
            ride = db.execute("SELECT user_id, status FROM rides WHERE id = ?", (ride_id,)).fetchone()
            if not ride:
                return jsonify(error="الطلب غير موجود"), 404
            if ride["user_id"] != user["id"]:
                return jsonify(error="ليس لديك صلاحية على هذا الطلب"), 403
            if ride["status"] not in {"pending", "accepted"}:
                return jsonify(error="لا يمكن إلغاء الرحلة في هذه المرحلة"), 400
            db.execute("UPDATE rides SET status = 'cancelled', updated_at = ? WHERE id = ?", (datetime.now(timezone.utc).isoformat(), ride_id))
            db.commit()
        return get_ride(ride_id)

    if user["role"] == "driver":
        with db_connection() as db:
            approved = db.execute(
                """SELECT drivers.id FROM drivers JOIN driver_applications
                   ON driver_applications.user_id = drivers.user_id
                   WHERE drivers.user_id = ? AND driver_applications.status = 'approved'""",
                (user["id"],),
            ).fetchone()
        if not approved:
            return jsonify(error="حساب السائق ما زال بانتظار موافقة الإدارة"), 403
        driver_id = approved["id"]

    now = datetime.now(timezone.utc).isoformat()
    with db_connection() as db:
        exists = db.execute("SELECT id FROM rides WHERE id = ?", (ride_id,)).fetchone()
        if not exists:
            return jsonify(error="الطلب غير موجود"), 404
        if driver_id:
            db.execute(
                "UPDATE rides SET status = ?, driver_id = ?, updated_at = ? WHERE id = ?",
                (status, int(driver_id), now, ride_id),
            )
        else:
            db.execute(
                "UPDATE rides SET status = ?, updated_at = ? WHERE id = ?",
                (status, now, ride_id),
            )
        db.commit()
    return get_ride(ride_id)


@app.patch("/api/drivers/<int:driver_id>")
@login_required()
def update_driver(driver_id):
    user = current_user()
    if user["role"] == "driver":
        with db_connection() as db:
            own_driver = db.execute("SELECT id FROM drivers WHERE user_id = ?", (user["id"],)).fetchone()
        if not own_driver:
            return jsonify(error="حساب السائق غير مفعل بعد"), 403
        driver_id = own_driver["id"]
    elif user["role"] != "admin":
        return jsonify(error="ليس لديك صلاحية"), 403
    data = request.get_json(silent=True) or {}
    online = 1 if data.get("online") else 0
    with db_connection() as db:
        cursor = db.execute("UPDATE drivers SET online = ? WHERE id = ?", (online, driver_id))
        db.commit()
    if not cursor.rowcount:
        return jsonify(error="السائق غير موجود"), 404
    return jsonify(id=driver_id, online=online)


@app.get("/api/driver/me")
@login_required("driver")
def driver_me():
    user = current_user()
    with db_connection() as db:
        application = db.execute(
            "SELECT status, review_notes FROM driver_applications WHERE user_id = ?",
            (user["id"],),
        ).fetchone()
        if not application or application["status"] != "approved":
            return jsonify(error="حسابك ما زال بانتظار موافقة الإدارة"), 403
        driver = db.execute("SELECT * FROM drivers WHERE user_id = ?", (user["id"],)).fetchone()
        if not driver:
            return jsonify(error="ملف السائق غير مفعل بعد، راجع الإدارة"), 403
        today = datetime.now(timezone.utc).date().isoformat()
        today_row = db.execute(
            """SELECT COUNT(*) AS rides_today,
                      COALESCE(SUM(price), 0) AS earnings_today
               FROM rides WHERE driver_id = ? AND status = 'completed'
               AND substr(updated_at, 1, 10) = ?""",
            (driver["id"], today),
        ).fetchone()
        totals = db.execute(
            """SELECT COUNT(*) AS total_rides,
                      COALESCE(SUM(price), 0) AS total_earnings
               FROM rides WHERE driver_id = ? AND status = 'completed'""",
            (driver["id"],),
        ).fetchone()
        reviews = db.execute(
            """SELECT ride_ratings.stars, ride_ratings.comment, ride_ratings.created_at, rides.id AS ride_id
               FROM ride_ratings JOIN rides ON rides.id = ride_ratings.ride_id
               WHERE ride_ratings.driver_id = ? ORDER BY ride_ratings.id DESC LIMIT 8""",
            (driver["id"],),
        ).fetchall()
    return jsonify(
        driver=dict(driver),
        rides_today=today_row["rides_today"],
        earnings_today=today_row["earnings_today"],
        total_rides=totals["total_rides"],
        total_earnings=totals["total_earnings"],
        reviews=[dict(row) for row in reviews],
    )


@app.get("/api/customer/stats")
@login_required("customer")
def customer_stats():
    user = current_user()
    with db_connection() as db:
        stats = db.execute(
            """SELECT COUNT(*) AS total_rides,
                      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_rides,
                      SUM(CASE WHEN status IN ('pending','accepted','arriving','in_trip') THEN 1 ELSE 0 END) AS active_rides,
                      COALESCE(SUM(CASE WHEN status = 'completed' THEN price ELSE 0 END), 0) AS total_spent
               FROM rides WHERE user_id = ?""",
            (user["id"],),
        ).fetchone()
    return jsonify(dict(stats))



@app.get("/api/stats")
@login_required("admin")
def get_stats():
    today = datetime.now(timezone.utc).date().isoformat()
    with db_connection() as db:
        stats = db.execute(
            """
            SELECT COUNT(*) AS total_rides,
                   SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
                   SUM(CASE WHEN status IN ('pending','accepted','arriving','in_trip') THEN 1 ELSE 0 END) AS active,
                   COALESCE(SUM(CASE WHEN status = 'completed' THEN price ELSE 0 END), 0) AS revenue
            FROM rides WHERE substr(created_at, 1, 10) = ?
            """,
            (today,),
        ).fetchone()
        online = db.execute("SELECT COUNT(*) AS count FROM drivers WHERE online = 1").fetchone()["count"]
        customers = db.execute("SELECT COUNT(*) AS count FROM users WHERE role = 'customer'").fetchone()["count"]
        average_rating = db.execute("SELECT ROUND(AVG(rating), 2) AS average FROM drivers").fetchone()["average"]
        weekly = []
        for offset in range(6, -1, -1):
            target = datetime.now(timezone.utc).date() - timedelta(days=offset)
            row = db.execute(
                """SELECT COUNT(*) AS rides,
                          COALESCE(SUM(CASE WHEN status = 'completed' THEN price ELSE 0 END), 0) AS revenue
                   FROM rides WHERE substr(created_at, 1, 10) = ?""",
                (target.isoformat(),),
            ).fetchone()
            weekly.append({"date": target.isoformat(), "rides": row["rides"], "revenue": row["revenue"]})
        top_drivers = db.execute(
            """SELECT drivers.name, drivers.car, drivers.rating,
                      COUNT(rides.id) AS completed_rides,
                      COALESCE(SUM(rides.price), 0) AS revenue
               FROM drivers LEFT JOIN rides ON rides.driver_id = drivers.id AND rides.status = 'completed'
               GROUP BY drivers.id ORDER BY completed_rides DESC, drivers.rating DESC LIMIT 5"""
        ).fetchall()
    result = dict(stats)
    result["online_drivers"] = online
    result["total_customers"] = customers
    result["avg_driver_rating"] = average_rating
    result["weekly"] = weekly
    result["top_drivers"] = [dict(row) for row in top_drivers]
    return jsonify(result)


if bot:
    @bot.message_handler(commands=["start"])
    def send_welcome(message):
        bot.reply_to(
            message,
            f"أهلاً {message.from_user.first_name} في دجلة رايد 🚕\n"
            "خدمة حجز التكسي داخل الناصرية.",
        )

    @bot.message_handler(commands=["طلبات"])
    def pending_rides(message):
        with db_connection() as db:
            count = db.execute("SELECT COUNT(*) AS count FROM rides WHERE status = 'pending'").fetchone()["count"]
        bot.reply_to(message, f"يوجد {count} طلب بانتظار سائق حالياً.")


def run_bot():
    if bot:
        try:
            bot.infinity_polling(skip_pending=True)
        except Exception as exc:
            app.logger.error("Telegram bot stopped: %s", exc)


init_db()

if __name__ == "__main__":
    if bot:
        threading.Thread(target=run_bot, daemon=True).start()
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port, debug=False)
