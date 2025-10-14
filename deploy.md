gcloud auth application-default login
gcloud config set account rtroman14@gmail.com
gcloud config set project roofgpt

gcloud run deploy lead-gen \
 --allow-unauthenticated \
 --region=us-central1 \
 --timeout=300s \
 --env-vars-file=.env.yaml
