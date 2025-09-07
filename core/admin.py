from django.contrib import admin
from .models import Dataset, Record

@admin.register(Dataset)
class DatasetAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'uploaded_at')

@admin.register(Record)
class RecordAdmin(admin.ModelAdmin):
    list_display = ('id', 'dataset')
    list_filter = ('dataset',)
