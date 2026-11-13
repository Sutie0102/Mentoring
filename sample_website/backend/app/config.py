from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """환경변수에서 읽어오는 설정 값 (docker-compose.yml / .env 참고)"""

    database_url: str = "postgresql+psycopg://blog:blog@localhost:5432/blog"
    jwt_secret: str = "dev-secret"
    jwt_expire_minutes: int = 60 * 24


settings = Settings()
