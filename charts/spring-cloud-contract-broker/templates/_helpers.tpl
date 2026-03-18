{{/*
Expand the name of the chart.
*/}}
{{- define "spring-cloud-contract-broker.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "spring-cloud-contract-broker.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "spring-cloud-contract-broker.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels.
*/}}
{{- define "spring-cloud-contract-broker.labels" -}}
helm.sh/chart: {{ include "spring-cloud-contract-broker.chart" . }}
{{ include "spring-cloud-contract-broker.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels.
*/}}
{{- define "spring-cloud-contract-broker.selectorLabels" -}}
app.kubernetes.io/name: {{ include "spring-cloud-contract-broker.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use.
*/}}
{{- define "spring-cloud-contract-broker.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "spring-cloud-contract-broker.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Create the name of the secret containing database credentials.
*/}}
{{- define "spring-cloud-contract-broker.secretName" -}}
{{- if .Values.postgresql.existingSecret }}
{{- .Values.postgresql.existingSecret }}
{{- else }}
{{- include "spring-cloud-contract-broker.fullname" . }}
{{- end }}
{{- end }}
