import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Section, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  title?: string;
  body?: string;
  tone?: string;
  siteName?: string;
}

const TONE_ACCENT: Record<string, string> = {
  love: "#e05a7b",
  sparkle: "#c89b6a",
  info: "#7a8fb8",
  success: "#6da88a",
  warning: "#c58a4b",
};

const Email = ({ title = "A note from Pandacine", body = "", tone = "sparkle", siteName = "Pandacine" }: Props) => {
  const accent = TONE_ACCENT[tone] ?? TONE_ACCENT.sparkle;
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{title}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={{ textAlign: "center" as const }}>
            <Text style={eyebrow(accent)}>{siteName} · a message</Text>
            <Heading style={heading}>{title}</Heading>
          </Section>
          <Section style={card(accent)}>
            {body.split(/\n+/).map((line, i) => (
              <Text key={i} style={paragraph}>{line}</Text>
            ))}
          </Section>
          <Text style={footer}>Sent with care from the {siteName} salon.</Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: Email,
  subject: (data: Record<string, any>) => (data?.title as string) || "A note from Pandacine",
  displayName: "Broadcast announcement",
  previewData: {
    title: "Anniversary lights are on",
    body: "A little story awaits at the top of your salon tonight.",
    tone: "love",
    siteName: "Pandacine",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Georgia, 'Times New Roman', serif", padding: "24px 0" };
const container = { maxWidth: "560px", margin: "0 auto", padding: "0 24px" };
const eyebrow = (accent: string) => ({
  color: accent,
  fontSize: "11px",
  letterSpacing: "0.22em",
  textTransform: "uppercase" as const,
  fontFamily: "Arial, sans-serif",
  margin: "0 0 6px",
});
const heading = { fontSize: "26px", color: "#241a1e", margin: "0 0 20px", fontStyle: "italic" as const };
const card = (accent: string) => ({
  border: `1px solid ${accent}33`,
  borderRadius: "16px",
  padding: "22px 24px",
  background: `linear-gradient(180deg, ${accent}0d, #ffffff)`,
});
const paragraph = { color: "#3b2a30", fontSize: "15px", lineHeight: "1.55", margin: "0 0 10px" };
const footer = { color: "#8a7078", fontSize: "12px", textAlign: "center" as const, marginTop: "22px", fontFamily: "Arial, sans-serif" };
