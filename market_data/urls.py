from django.urls import path

from .views import RealtimeDashboardView

urlpatterns = [
    path("dashboard/realtime", RealtimeDashboardView.as_view(), name="dashboard-realtime"),
]
