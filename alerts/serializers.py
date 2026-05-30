from rest_framework import serializers

from .models import AlertHistory, AlertRule


class AlertRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = AlertRule
        fields = ["id", "name", "rule_type", "threshold", "enabled", "created_at", "updated_at"]


class AlertHistorySerializer(serializers.ModelSerializer):
    rule_name = serializers.CharField(source="rule.name", read_only=True)

    class Meta:
        model = AlertHistory
        fields = [
            "id",
            "rule",
            "rule_name",
            "triggered_at",
            "current_price",
            "predicted_price",
            "message",
        ]
