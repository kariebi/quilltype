import { useListDeploymentsQuery } from "./generated/api-react-query";

const client = {
  baseUrl: "http://127.0.0.1:8040",
};

export function DeploymentList() {
  const { data, isLoading } = useListDeploymentsQuery(client);

  if (isLoading) {
    return <p>Loading…</p>;
  }

  return (
    <ul>
      {(data ?? []).map((deployment) => (
        <li key={deployment.id}>
          {deployment.environment}: {deployment.status}
        </li>
      ))}
    </ul>
  );
}
