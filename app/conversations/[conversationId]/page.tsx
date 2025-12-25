import getConversationById from "@/app/actions/getConversationById";
import getMessages from "@/app/actions/getMessages";
import EmptyState from "@/app/components/EmptyState";
import Header from "./components/Header";
import Body from "./components/Body";
import Form from "./components/Form";
import { ConversationProvider } from "./ConversationContext"; 

interface IParams {
  conversationId: string;
}

const ConversationId = async ({ params }: { params: IParams }) => {
  const { conversationId } = await params;
  
  // Fetch in parallel for better performance
  const [conversation, messages] = await Promise.all([
    getConversationById(conversationId),
    getMessages(conversationId),
  ]);

  if (!conversation) {
    return (
      <div className="lg:pl-80 h-full">
        <div className="h-full flex flex-col">
          <EmptyState />
        </div>
      </div>
    );
  }

  // Check if Gemini AI is in this conversation
  const hasGeminiBot = conversation.users.some(
    (user) => user.email === 'gemini@messenger.com'
  );
  
  // isBot = true only for direct 1-1 chat with Gemini (not group)
  // In groups, Gemini only responds when tagged @Gemini AI
  const isDirectBotChat = hasGeminiBot && !conversation.isGroup;

  return (
    <div className="lg:pl-80 h-full">
      <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
        <ConversationProvider>
            <Header conversation={conversation} />
            <Body initialMessages={messages} />
            <Form 
              isBot={isDirectBotChat} 
              conversationUsers={conversation.users} 
            />
        </ConversationProvider>
      </div>
    </div>
  );
};

export default ConversationId;