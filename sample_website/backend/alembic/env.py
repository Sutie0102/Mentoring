from logging.config import fileConfig

from alembic import context

from app.database import Base, engine
from app import models  # noqa: F401  (모델을 import해야 metadata에 테이블이 등록됨)

if context.config.config_file_name is not None:
    fileConfig(context.config.config_file_name)

target_metadata = Base.metadata


def run_migrations_online():
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


run_migrations_online()
