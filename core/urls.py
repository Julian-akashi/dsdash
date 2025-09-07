from django.urls import path
from .views import upload_csv, list_datasets, profile, top_categories, series_por_fecha, delete_dataset

urlpatterns = [
    path('upload', upload_csv),
    path('datasets', list_datasets),
    path('<int:dataset_id>/profile', profile),
    path('<int:dataset_id>/categories', top_categories),
    path('<int:dataset_id>/timeseries', series_por_fecha),
    path('<int:dataset_id>/delete', delete_dataset),  # <- nuevo
]
