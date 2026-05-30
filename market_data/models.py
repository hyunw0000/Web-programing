from django.db import models


class RawMarketData(models.Model):
    SOURCE_CHOICES = [
        ("opinet", "Opinet"),
        ("yfinance", "Yahoo Finance"),
        ("news", "News"),
        ("manual", "Manual"),
    ]

    source = models.CharField(max_length=50, choices=SOURCE_CHOICES)
    symbol = models.CharField(max_length=50)
    observed_at = models.DateTimeField()
    value = models.DecimalField(max_digits=14, decimal_places=4)
    unit = models.CharField(max_length=30, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "raw_market_data"
        ordering = ["-observed_at"]
        indexes = [
            models.Index(fields=["source", "symbol", "-observed_at"]),
        ]

    def __str__(self):
        return f"{self.source}:{self.symbol}@{self.observed_at}"
