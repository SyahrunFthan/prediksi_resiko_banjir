import json
import os
import urllib.request
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point, Polygon

LOCAL_GEOJSON_PATH = os.path.join(os.path.dirname(__file__), "sulawesi_tengah_boundaries.json")

GEOJSON_URLS = [
    "https://raw.githubusercontent.com/superpikar/indonesia-geojson/master/indonesia-province.json"
]

def download_or_load_geojson():
    """
    Downloads or loads local GeoJSON boundary data for Central Sulawesi.
    """
    if os.path.exists(LOCAL_GEOJSON_PATH):
        try:
            gdf = gpd.read_file(LOCAL_GEOJSON_PATH)
            if not gdf.empty:
                return gdf
        except Exception as e:
            print(f"Warning: Failed reading local GeoJSON ({e}), regenerating...")

    for url in GEOJSON_URLS:
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=3) as resp:
                if resp.status == 200:
                    raw_data = resp.read().decode('utf-8')
                    data = json.loads(raw_data)
                    
                    if 'features' in data:
                        filtered_features = []
                        for feat in data['features']:
                            props = feat.get('properties', {})
                            name_str = str(props.get('NAME_1', '') or props.get('Propinsi', '') or props.get('provinsi', '') or props.get('name', '')).lower()
                            prov_code = str(props.get('id', '') or props.get('kode', ''))
                            
                            if 'sulawesi tengah' in name_str or 'sulteng' in name_str or prov_code == '72':
                                filtered_features.append(feat)
                        
                        if filtered_features:
                            data['features'] = filtered_features
                            with open(LOCAL_GEOJSON_PATH, 'w', encoding='utf-8') as f:
                                json.dump(data, f)
                            gdf = gpd.read_file(LOCAL_GEOJSON_PATH)
                            return gdf
        except Exception as err:
            print(f"Remote fetch skipped ({url}): {err}")

    return None

def create_fallback_kabupaten_gdf(df):
    """
    Generates convex hull boundary polygons for each Kabupaten in Sulawesi Tengah
    using GeoPandas from lat/lon coordinates in dataset_cuaca_sulawesi_tengah.csv.
    """
    polygons = []
    names = []
    
    for kab, group in df.groupby('kabupaten_kota'):
        valid_coords = group.dropna(subset=['longitude', 'latitude'])
        points = [Point(xy) for xy in zip(valid_coords['longitude'], valid_coords['latitude'])]
        if len(points) >= 3:
            mp = gpd.GeoSeries(points)
            hull = mp.unary_union.convex_hull
            poly = hull.buffer(0.05)
            polygons.append(poly)
            names.append(kab)
        elif len(points) > 0:
            p = points[0].buffer(0.08)
            polygons.append(p)
            names.append(kab)

    gdf = gpd.GeoDataFrame({
        'kabupaten_kota': names,
        'geometry': polygons
    }, crs="EPSG:4326")
    
    try:
        gdf.to_file(LOCAL_GEOJSON_PATH, driver="GeoJSON")
    except Exception as e:
        print(f"Warning saving fallback GeoJSON: {e}")
        
    return gdf

def load_sulteng_geodataframe(df_weather):
    """
    Returns a GeoDataFrame for Sulawesi Tengah administrative boundaries.
    """
    gdf = download_or_load_geojson()
    if gdf is None or gdf.empty:
        print("Building GeoPandas boundary GeoDataFrame from coordinates...")
        gdf = create_fallback_kabupaten_gdf(df_weather)
    return gdf

def get_sulteng_geojson_dict(df_weather):
    """
    Loads Sulawesi Tengah GeoDataFrame via GeoPandas and returns it as a JSON-serializable dict.
    """
    gdf = load_sulteng_geodataframe(df_weather)
    geojson_str = gdf.to_json()
    return json.loads(geojson_str)

def convert_weather_df_to_gdf(df):
    """
    Converts weather pandas DataFrame into a GeoPandas GeoDataFrame with Point geometry.
    """
    df_clean = df.dropna(subset=['latitude', 'longitude']).copy()
    df_clean['latitude'] = pd.to_numeric(df_clean['latitude'], errors='coerce')
    df_clean['longitude'] = pd.to_numeric(df_clean['longitude'], errors='coerce')
    
    gdf = gpd.GeoDataFrame(
        df_clean,
        geometry=gpd.points_from_xy(df_clean.longitude, df_clean.latitude),
        crs="EPSG:4326"
    )
    return gdf
