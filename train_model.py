import os
import json
import joblib
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score, confusion_matrix

DATASET_PATH = os.path.join(os.path.dirname(__file__), "dataset_cuaca_sulawesi_tengah.csv")
MODEL_PATH = os.path.join(os.path.dirname(__file__), "model_banjir.joblib")

def calculate_flood_risk_score(row):
    """
    Computes a hydrometeorological flood risk score (0.0 to 1.0)
    based on humidity, cloud cover, weather code, wind speed, and temperature.
    """
    try:
        humidity = float(row.get('kelembapan', 0))
    except (ValueError, TypeError):
        humidity = 50.0

    try:
        cloud_cover = float(row.get('tutupan_awan', 0))
    except (ValueError, TypeError):
        cloud_cover = 50.0

    try:
        wind_speed = float(row.get('kecepatan_angin', 0))
    except (ValueError, TypeError):
        wind_speed = 10.0

    try:
        temp = float(row.get('suhu', 25))
    except (ValueError, TypeError):
        temp = 25.0

    weather_desc = str(row.get('deskripsi_cuaca', '')).lower()
    weather_code = str(row.get('kode_cuaca', ''))

    # Rain severity score (0 to 0.45)
    rain_score = 0.0
    if 'hujan' in weather_desc or weather_code in ['60', '61', '62', '63', '95', '97']:
        rain_score = 0.45
    elif 'berawan' in weather_desc:
        rain_score = 0.20
    elif 'kabut' in weather_desc or 'asap' in weather_desc:
        rain_score = 0.15
    else:
        rain_score = 0.05

    # Humidity score (0 to 0.30)
    humidity_score = max(0.0, (humidity - 50.0) / 50.0) * 0.30

    # Cloud cover score (0 to 0.15)
    cloud_score = (cloud_cover / 100.0) * 0.15

    # Wind & temp factor (0 to 0.10)
    wind_temp_score = min(0.10, (wind_speed / 40.0) * 0.05 + (30.0 - temp if temp < 30 else 0) * 0.005)

    total_score = min(1.0, rain_score + humidity_score + cloud_score + wind_temp_score)
    return total_score

def categorize_risk(score):
    """
    Categorizes numerical score into 3 Risk Classes:
    - Rendah (< 0.40)
    - Sedang (0.40 - 0.65)
    - Tinggi (> 0.65)
    """
    if score >= 0.65:
        return 'Tinggi'
    elif score >= 0.40:
        return 'Sedang'
    else:
        return 'Rendah'

def load_and_preprocess_data():
    print("Loading dataset from:", DATASET_PATH)
    df = pd.read_csv(DATASET_PATH)

    # Convert numeric columns
    numeric_cols = ['suhu', 'kelembapan', 'kode_cuaca', 'kecepatan_angin', 'tutupan_awan', 'latitude', 'longitude', 'jam', 'bulan', 'hari']
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')

    # Drop rows missing crucial parameters
    df = df.dropna(subset=['suhu', 'kelembapan', 'latitude', 'longitude']).copy()

    # Calculate target variable: Flood Risk Score and Class
    print("Calculating Flood Risk Scores & Categories...")
    df['risk_score'] = df.apply(calculate_flood_risk_score, axis=1)
    df['kategori_risiko'] = df['risk_score'].apply(categorize_risk)

    return df

def train_and_save_model():
    df = load_and_preprocess_data()

    features = ['suhu', 'kelembapan', 'kode_cuaca', 'kecepatan_angin', 'tutupan_awan', 'latitude', 'longitude', 'jam', 'bulan']
    
    # Fill missing values in feature set with median
    X = df[features].fillna(df[features].median())
    y = df['kategori_risiko']

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    print(f"Training Random Forest Classifier on {len(X_train)} samples...")
    clf = RandomForestClassifier(n_estimators=100, max_depth=15, random_state=42, n_jobs=-1)
    clf.fit(X_train, y_train)

    y_pred = clf.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    report = classification_report(y_test, y_pred)
    cm = confusion_matrix(y_test, y_pred, labels=['Rendah', 'Sedang', 'Tinggi']).tolist()

    print(f"Model Accuracy: {acc * 100:.2f}%")
    print("\nClassification Report:\n", report)

    # Feature Importance
    importances = dict(zip(features, clf.feature_importances_.round(4)))

    model_artifact = {
        'model': clf,
        'features': features,
        'accuracy': float(acc),
        'classification_report': report,
        'confusion_matrix': cm,
        'feature_importances': importances,
        'classes': ['Rendah', 'Sedang', 'Tinggi']
    }

    joblib.dump(model_artifact, MODEL_PATH)
    print("Saved trained model artifact to:", MODEL_PATH)
    return df, model_artifact

if __name__ == "__main__":
    train_and_save_model()
