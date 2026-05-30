from django.urls import path

from .views import (
    AlertEvaluateView,
    AlertHistoryListView,
    AlertRuleDetailView,
    AlertRuleListCreateView,
)

urlpatterns = [
    path("alerts/rules", AlertRuleListCreateView.as_view(), name="alert-rules"),
    path("alerts/rules/<int:rule_id>", AlertRuleDetailView.as_view(), name="alert-rule-detail"),
    path("alerts/history", AlertHistoryListView.as_view(), name="alert-history"),
    path("alerts/evaluate", AlertEvaluateView.as_view(), name="alert-evaluate"),
]
