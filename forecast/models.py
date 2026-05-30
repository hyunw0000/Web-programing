from django.db import models


class PriceForecast(models.Model):
    target_date = models.DateField()
    horizon_days = models.PositiveIntegerField()
    model_name = models.CharField(max_length=50, default="baseline")
    predicted_price = models.DecimalField(max_digits=14, decimal_places=4)
    lower_bound = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    upper_bound = models.DecimalField(max_digits=14, decimal_places=4, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "price_forecast"
        ordering = ["target_date", "horizon_days"]
        indexes = [
            models.Index(fields=["target_date", "horizon_days"]),
            models.Index(fields=["model_name"]),
        ]

    def __str__(self):
        return f"{self.target_date} (D+{self.horizon_days}) = {self.predicted_price}"
