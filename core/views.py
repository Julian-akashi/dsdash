import csv, io
from django.db import transaction
from django.http import JsonResponse, HttpResponseBadRequest
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
from .models import Dataset, Record
from .utils import df_from_dataset, basic_profile, timeseries_counts
from .models import Dataset

def list_datasets(request):
    data = [{'id': d.id, 'name': d.name, 'rows': d.records.count(), 'uploaded_at': d.uploaded_at.isoformat()}
            for d in Dataset.objects.order_by('-uploaded_at')[:100]]
    return JsonResponse(data, safe=False)

@csrf_exempt
def upload_csv(request):
    if request.method != 'POST' or 'file' not in request.FILES:
        return HttpResponseBadRequest('Sube un archivo CSV en "file".')
    f = request.FILES['file']
    name = request.POST.get('name', f.name)

    try:
        decoded = io.TextIOWrapper(f.file, encoding=request.encoding or 'utf-8', errors='replace')
        reader = csv.DictReader(decoded)
    except Exception as e:
        return HttpResponseBadRequest(f'CSV inválido: {e}')

    with transaction.atomic():
        ds = Dataset.objects.create(name=name)
        batch = []
        for row in reader:
            batch.append(Record(dataset=ds, data=row))
            if len(batch) >= 2000:
                Record.objects.bulk_create(batch)
                batch.clear()
        if batch:
            Record.objects.bulk_create(batch)

    return JsonResponse({'dataset_id': ds.id, 'name': ds.name, 'rows': ds.records.count()})

def profile(request, dataset_id: int):
    ds = get_object_or_404(Dataset, pk=dataset_id)
    df = df_from_dataset(ds)
    return JsonResponse(basic_profile(df))

def top_categories(request, dataset_id: int):
    ds = get_object_or_404(Dataset, pk=dataset_id)
    df = df_from_dataset(ds)
    prof = basic_profile(df)
    return JsonResponse(prof.get('categorical_value_counts', {}))

def series_por_fecha(request, dataset_id: int):
    ds = get_object_or_404(Dataset, pk=dataset_id)
    df = df_from_dataset(ds)
    date_col = request.GET.get('col')
    series = timeseries_counts(df, date_col)
    return JsonResponse(series, safe=False)

@csrf_exempt
def delete_dataset(request, dataset_id: int):
    if request.method != "DELETE":
        return HttpResponseBadRequest("Usa método DELETE")
    ds = get_object_or_404(Dataset, pk=dataset_id)
    ds.delete()
    return JsonResponse({"ok": True, "deleted_id": dataset_id})
