import { fetchMenu } from "@/services/api";
import { MenuExperience } from "./MenuExperience";

type PageProps = {
  params: { restaurantId: string; tableId: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function Page({ params, searchParams }: PageProps) {
  const menu = await fetchMenu(params.restaurantId);
  const sessionId =
    typeof searchParams?.sessionId === "string" ? (searchParams?.sessionId as string) : undefined;
  return (
    <MenuExperience
      menu={menu}
      restaurantId={params.restaurantId}
      tableId={params.tableId}
      sessionId={sessionId}
    />
  );
}
