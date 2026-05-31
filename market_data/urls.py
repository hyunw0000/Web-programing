from django.urls import path

from .views import DashboardRefreshView, RealtimeDashboardView, ChatView, HistoricalDataView

urlpatterns = [
    path("dashboard/realtime", RealtimeDashboardView.as_view(), name="dashboard-realtime"),
    path("dashboard/refresh", DashboardRefreshView.as_view(), name="dashboard-refresh"),
    path("chat", ChatView.as_view(), name="chat"),
    path("history", HistoricalDataView.as_view(), name="history"),
]
