from django.db import models


class MarketBriefing(models.Model):
    SENTIMENT_CHOICES = [
        ("bullish", "Bullish"),
        ("bearish", "Bearish"),
        ("neutral", "Neutral"),
    ]

    title = models.CharField(max_length=200)
    summary = models.TextField()
    sentiment = models.CharField(max_length=20, choices=SENTIMENT_CHOICES, default="neutral")
    score = models.FloatField(null=True, blank=True)
    based_on_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "market_briefing"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["-created_at"]),
            models.Index(fields=["sentiment"]),
        ]

    def __str__(self):
        return self.title
