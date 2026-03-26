interface JsonViewerProps {
  content: string;
}

export default function JsonViewer({ content }: JsonViewerProps) {
  let formatted = content;
  try {
    formatted = JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    // Not JSON, display as-is (likely YAML)
  }

  return (
    <pre className="bg-muted border border-border rounded-lg p-4 text-xs text-foreground overflow-x-auto font-mono leading-relaxed">
      {formatted}
    </pre>
  );
}
