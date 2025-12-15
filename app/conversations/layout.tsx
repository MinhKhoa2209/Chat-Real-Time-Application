import getConversations from "../actions/getConversation";
import getUsers from "../actions/getUsers";
import Sidebar from "../components/sidebar/Sidebar";
import ConversationList from "./components/ConversationList";

export default async function ConversationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fetch in parallel for better performance
  const [conversations, users] = await Promise.all([
    getConversations(),
    getUsers(),
  ]);
  
  return (
    <Sidebar>
      <div className="h-full">
        <ConversationList users={users as any} initialItems={conversations as any} />
        {children}
      </div>
    </Sidebar>
  );
}
