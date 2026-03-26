function ChatPage({ intro, content }) {
  return (
    <div className="page-stack">
      {intro}
      <section className="page-grid page-grid--chat">
        {content}
      </section>
    </div>
  );
}

export default ChatPage;
