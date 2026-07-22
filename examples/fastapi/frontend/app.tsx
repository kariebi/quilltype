import { useListTodosQuery } from "./generated/api-react-query";

const client = {
  baseUrl: "http://127.0.0.1:8010",
};

export function TodoList() {
  const { data, isLoading } = useListTodosQuery(client);

  if (isLoading) {
    return <p>Loading…</p>;
  }

  return (
    <ul>
      {(data ?? []).map((todo) => (
        <li key={todo.id}>
          {todo.title} {todo.done ? "done" : "open"}
        </li>
      ))}
    </ul>
  );
}
