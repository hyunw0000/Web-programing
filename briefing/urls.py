from django.urls import path

from .views import LatestBriefingView

urlpatterns = [
    path("briefings/latest", LatestBriefingView.as_view(), name="briefing-latest"),
]
