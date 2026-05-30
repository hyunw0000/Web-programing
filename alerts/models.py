from django.db import models


class AlertRule(models.Model):
    RULE_TYPE_CHOICES = [
        ("rise", "Rise"),
        ("drop", "Drop"),
    ]

    name = models.CharField(max_length=100)
    rule_type = models.CharField(max_length=10, choices=RULE_TYPE_CHOICES)
    threshold = models.DecimalField(max_digits=10, decimal_places=2)
    enabled = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "alert_rule"
        ordering = ["-created_at"]

    def __str__(self):
        return self.name


class AlertHistory(models.Model):
    rule = models.ForeignKey(AlertRule, on_delete=models.CASCADE, related_name="histories")
    triggered_at = models.DateTimeField(auto_now_add=True)
    current_price = models.DecimalField(max_digits=10, decimal_places=2)
    predicted_price = models.DecimalField(max_digits=10, decimal_places=2)
    message = models.TextField()

    class Meta:
        db_table = "alert_history"
        ordering = ["-triggered_at"]
