from django.urls import path

from .views import DashboardRefreshView, RealtimeDashboardView

urlpatterns = [
    path("dashboard/realtime", RealtimeDashboardView.as_view(), name="dashboard-realtime"),
    path("dashboard/refresh", DashboardRefreshView.as_view(), name="dashboard-refresh"),
]
