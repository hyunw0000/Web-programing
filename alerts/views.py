from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AlertHistory, AlertRule
from .serializers import AlertHistorySerializer, AlertRuleSerializer
from .services import evaluate_alert_rules


class AlertRuleListCreateView(APIView):
    def get(self, request):
        rows = AlertRule.objects.all()
        return Response(AlertRuleSerializer(rows, many=True).data)

    def post(self, request):
        serializer = AlertRuleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class AlertRuleDetailView(APIView):
    def patch(self, request, rule_id):
        try:
            instance = AlertRule.objects.get(id=rule_id)
        except AlertRule.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = AlertRuleSerializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, rule_id):
        deleted, _ = AlertRule.objects.filter(id=rule_id).delete()
        if not deleted:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


class AlertHistoryListView(APIView):
    def get(self, request):
        rows = AlertHistory.objects.all()[:50]
        return Response(AlertHistorySerializer(rows, many=True).data)


class AlertEvaluateView(APIView):
    def post(self, request):
        triggered = evaluate_alert_rules()
        return Response({"triggered_count": triggered})
