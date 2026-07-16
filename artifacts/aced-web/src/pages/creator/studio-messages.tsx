import { useGetMyConversations } from '@workspace/api-client-react';
import { Card } from '@/components/ui/card';
import { MessageSquare } from 'lucide-react';

export default function StudioMessages() {
  const { data: response, isLoading } = useGetMyConversations();

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col">
      <div>
        <h1 className="text-3xl font-bold font-serif mb-6">Student Messages</h1>
      </div>

      <Card className="flex-1 flex overflow-hidden">
        {/* Contacts List */}
        <div className="w-1/3 border-r bg-muted/10 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Loading conversations...</div>
          ) : response?.data?.length ? (
            <div className="divide-y">
              {response.data.map((conv: any) => (
                <div key={conv.id} className="p-4 hover:bg-muted/30 cursor-pointer">
                  <div className="font-semibold">{conv.otherParticipant?.displayName || 'Student'}</div>
                  <div className="text-sm text-muted-foreground truncate">{conv.lastMessage?.content || 'No messages yet'}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 flex flex-col items-center justify-center text-center h-full">
              <MessageSquare className="h-8 w-8 text-muted-foreground/30 mb-4" />
              <p className="text-sm text-muted-foreground">No student messages yet.</p>
            </div>
          )}
        </div>

        {/* Message Thread */}
        <div className="flex-1 flex flex-col items-center justify-center bg-muted/5">
          <MessageSquare className="h-12 w-12 text-muted-foreground/20 mb-4" />
          <p className="text-muted-foreground font-medium">Select a conversation to respond</p>
        </div>
      </Card>
    </div>
  );
}
