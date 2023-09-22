# Helm Chart for the application

This is fairly standard/basic with
* env-specific overrides (for an env called 'dev')
* setting external-dns name and using a service load balancer to allow internet access with a friendly name

Todo:
* would like to show app-specific metrics and alerting in prometheus or similar
