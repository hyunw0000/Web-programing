from django.urls import path

from .views import ForecastView, PurchaseScoreView

urlpatterns = [
    path("forecast", ForecastView.as_view(), name="forecast"),
    path("purchase-score", PurchaseScoreView.as_view(), name="purchase-score"),
]
