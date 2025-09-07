import pandas as pd
import numpy as np
from dateutil.parser import parse as dtparse

def df_from_dataset(dataset):
    rows = list(dataset.records.values_list('data', flat=True))
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows)

    # Intento de convertir numéricos
    for c in df.columns:
        try:
            df[c] = pd.to_numeric(df[c], errors='ignore')
        except Exception:
            pass

    # Intento de convertir fechas (heurístico)
    for c in df.columns:
        if df[c].dtype == object:
            try:
                sample = next((v for v in df[c].dropna().head(20).values if str(v).strip()), None)
                if sample is not None:
                    _ = dtparse(str(sample), fuzzy=True)
                    df[c] = pd.to_datetime(df[c], errors='coerce', infer_datetime_format=True)
            except Exception:
                pass
    return df

def basic_profile(df: pd.DataFrame):
    nulls = df.isna().sum().to_dict()
    dups = int(df.duplicated().sum())
    dtypes = {c: str(dt) for c, dt in df.dtypes.to_dict().items()}

    desc_num = df.select_dtypes(include=[np.number]).describe().to_dict() if not df.empty else {}
    try:
        desc_all = df.describe(include='all', datetime_is_numeric=True).to_dict() if not df.empty else {}
    except Exception:
        desc_all = {}

    date_cols = [c for c in df.columns if str(df[c].dtype).startswith('datetime64')]
    cat_cols = [c for c in df.columns if df[c].nunique(dropna=False) <= max(30, int(0.1*len(df)))]

    cats_value_counts = {}
    for c in cat_cols:
        vc = df[c].astype('string').value_counts(dropna=False).head(15)
        cats_value_counts[c] = {str(k): int(v) for k, v in vc.items()}

    return {
        'rows': int(df.shape[0]),
        'cols': int(df.shape[1]),
        'nulls': nulls,
        'duplicates': dups,
        'dtypes': dtypes,
        'describe_numeric': desc_num,
        'describe_all': desc_all,
        'date_columns': date_cols,
        'categorical_columns': cat_cols,
        'categorical_value_counts': cats_value_counts,
    }

def timeseries_counts(df: pd.DataFrame, date_col: str | None = None):
    if df.empty:
        return []
    if date_col and date_col in df.columns and str(df[date_col].dtype).startswith('datetime64'):
        col = date_col
    else:
        cands = [c for c in df.columns if str(df[c].dtype).startswith('datetime64')]
        if not cands:
            return []
        col = cands[0]
    ser = df[col].dropna().dt.floor('D').value_counts().sort_index()
    return [{'date': str(k.date()), 'count': int(v)} for k, v in ser.items()]
