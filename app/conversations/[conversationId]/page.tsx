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
  
  const conversation = await getConversationById(conversationId);
  const messages = await getMessages(conversationId);

  if (!conversation) {
    return (
      <div className="lg:pl-80 h-full">
        <div className="h-full flex flex-col">
          <EmptyState />
        </div>
      </div>
    );
  }

  const isBot = conversation.users.some(
    (user) => user.email === 'gemini@messenger.com'
  );

  return (
    <div className="lg:pl-80 h-full">
      <div className="h-full flex flex-col">
        <ConversationProvider>
            <Header conversation={conversation} />
            <Body initialMessages={messages} />
            <Form isBot={isBot} />
        </ConversationProvider>
      </div>
    </div>
  );
};

export default ConversationId;