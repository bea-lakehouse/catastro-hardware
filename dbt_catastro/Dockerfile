FROM ghcr.io/dbt-labs/dbt-postgres:1.7.14

WORKDIR /usr/app

# Pin estable para evitar crash de dbt events
RUN python -m pip install --no-cache-dir --upgrade "protobuf==4.25.3"

COPY . .

ENV DBT_PROFILES_DIR=/usr/app

ENTRYPOINT ["dbt"]
