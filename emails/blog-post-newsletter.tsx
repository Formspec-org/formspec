/** @filedesc React Email template for blog post newsletter broadcasts. */
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Row,
  Column,
  Heading,
  Text,
  Button,
  Link,
  Hr,
  Tailwind,
} from "@react-email/components";

interface BlogPostNewsletterProps {
  title: string;
  description: string;
  postUrl: string;
  author: string;
  tags: string[];
}

export default function BlogPostNewsletter({
  title,
  description,
  postUrl,
  author,
  tags,
}: BlogPostNewsletterProps) {
  return (
    <Html lang="en">
      <Tailwind
        config={{
          theme: {
            extend: {
              colors: {
                accent: "#3d52d5",
                "accent-dark": "#2c42c4",
                ink: "#1a1a2e",
                "ink-secondary": "#4a4a6a",
                "ink-muted": "#8888aa",
                surface: "#ffffff",
                bg: "#fafaf9",
                border: "#e4e4e0",
                "tag-bg": "#eef0fb",
              },
            },
          },
        }}
      >
        <Head />
        <Preview>{description || `New on the Formspec blog: ${title}`}</Preview>
        <Body className="bg-bg font-sans m-0 p-0">
          <Container className="max-w-[560px] mx-auto py-[40px] px-[16px]">
            {/* Header */}
            <Text className="text-center text-[18px] font-bold text-ink tracking-tight m-0 pb-[32px]">
              Formspec
            </Text>

            {/* Card */}
            <Section className="bg-surface rounded-[12px] border border-solid border-border overflow-hidden">
              {/* Accent bar */}
              <Row>
                <Column
                  className="h-[4px] bg-accent"
                  style={{ lineHeight: "4px", fontSize: "4px" }}
                >
                  &nbsp;
                </Column>
              </Row>

              {/* Content */}
              <Section className="px-[36px] pt-[36px] pb-[12px]">
                <Text className="m-0 mb-[8px] text-[12px] font-semibold uppercase tracking-widest text-ink-muted">
                  New on the blog
                </Text>
                <Heading className="m-0 mb-[16px] text-[22px] font-bold leading-tight text-ink tracking-tight">
                  {title}
                </Heading>
                {description && (
                  <Text className="m-0 mb-[20px] text-[15px] leading-relaxed text-ink-secondary">
                    {description}
                  </Text>
                )}
                {tags.length > 0 && (
                  <Section className="mb-[24px]">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          display: "inline-block",
                          background: "#eef0fb",
                          color: "#3d52d5",
                          fontSize: "12px",
                          fontWeight: 600,
                          padding: "3px 10px",
                          borderRadius: "12px",
                          marginRight: "6px",
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </Section>
                )}
              </Section>

              {/* CTA */}
              <Section className="px-[36px] pb-[36px]">
                <Button
                  href={postUrl}
                  className="bg-accent text-surface text-[14px] font-semibold px-[28px] py-[12px] rounded-[8px] no-underline box-border"
                >
                  Read the post
                </Button>
              </Section>

              {/* Author */}
              <Section className="px-[36px] pb-[28px]">
                <Text className="m-0 text-[13px] text-ink-muted">
                  By {author}
                </Text>
              </Section>
            </Section>

            {/* Footer */}
            <Section className="pt-[28px] text-center">
              <Text className="m-0 mb-[6px] text-[12px] text-ink-muted">
                You're receiving this because you subscribed to Formspec
                updates.
              </Text>
              <Text className="m-0 text-[12px] text-ink-muted">
                <Link
                  href="{{{ unsubscribe_url }}}"
                  className="text-accent underline"
                >
                  Unsubscribe
                </Link>
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

BlogPostNewsletter.PreviewProps = {
  title: "Introducing Formspec: A JSON-native form specification",
  description:
    "Why we built a new form specification, what it solves, and how it fits into the ecosystem of tools for grants, field operations, and compliance workflows.",
  postUrl: "https://formspec.org/blog/introducing-formspec/",
  author: "Michael Deeb & Claude",
  tags: ["announcement", "specification"],
} satisfies BlogPostNewsletterProps;
