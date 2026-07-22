from fastapi import FastAPI
from pydantic import BaseModel


app = FastAPI(title="Quill Type FastAPI Example", version="1.0.0")


class Todo(BaseModel):
    id: int
    title: str
    done: bool


TODOS = [
    Todo(id=1, title="Ship Quill Type", done=False),
    Todo(id=2, title="Document the workflow", done=True),
]


@app.get("/todos", response_model=list[Todo], operation_id="listTodos")
def list_todos() -> list[Todo]:
    return TODOS
