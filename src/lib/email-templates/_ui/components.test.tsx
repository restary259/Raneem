import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";
import {
  EmailButton,
  EmailCard,
  EmailFallbackLink,
  EmailFooter,
  EmailHeader,
  EmailInfoRow,
  EmailLayout,
  EmailSocialLinks,
  EmailStatusBadge,
  EmailText,
} from "./components";
import { BRAND_NAME, BRAND_NAME_AR, LOGO_URL, SOCIAL_LINKS } from "./theme";

describe("EmailLayout", () => {
  it("renders the preview, title and children with RTL direction by default", async () => {
    const html = await render(
      <EmailLayout preview="preview text" title="عنوان">
        <EmailText>محتوى</EmailText>
      </EmailLayout>,
    );
    expect(html).toContain("preview text");
    expect(html).toContain("عنوان");
    expect(html).toContain("محتوى");
    expect(html).toContain('dir="rtl"');
    expect(html).toContain(LOGO_URL);
  });

  it("switches to LTR for English", async () => {
    const html = await render(
      <EmailLayout dir="ltr" lang="en" preview="p" title="Title">
        <EmailText dir="ltr">Body</EmailText>
      </EmailLayout>,
    );
    expect(html).toContain('dir="ltr"');
    expect(html).toContain('lang="en"');
  });
});

describe("EmailHeader", () => {
  it("shows the Arabic brand name in RTL", async () => {
    const html = await render(<EmailHeader />);
    expect(html).toContain(BRAND_NAME_AR);
    expect(html).toContain(LOGO_URL);
  });

  it("shows the Latin brand name in LTR", async () => {
    const html = await render(<EmailHeader dir="ltr" />);
    expect(html).toContain(BRAND_NAME);
  });
});

describe("EmailFooter / EmailSocialLinks", () => {
  it("includes every social link", async () => {
    const html = await render(<EmailSocialLinks />);
    for (const link of SOCIAL_LINKS) {
      expect(html).toContain(link.href);
    }
  });

  it("renders support contact details in RTL", async () => {
    const html = await render(<EmailFooter />);
    expect(html).toContain("واتساب الدعم");
    expect(html).toContain("darb.agency");
  });

  it("renders the English service-message notice in LTR", async () => {
    const html = await render(<EmailFooter dir="ltr" />);
    expect(html).toContain("WhatsApp support");
    expect(html).toContain("service message related to your Darb account");
  });
});

describe("EmailButton", () => {
  it("renders an anchor with the href", async () => {
    const html = await render(
      <EmailButton href="https://darb.agency/x">افتح</EmailButton>,
    );
    expect(html).toContain('href="https://darb.agency/x"');
    expect(html).toContain("افتح");
  });
});

describe("EmailCard", () => {
  it("wraps its children", async () => {
    const html = await render(
      <EmailCard>
        <EmailInfoRow label="المحادثة" value="DARB-1" />
      </EmailCard>,
    );
    expect(html).toContain("المحادثة");
    expect(html).toContain("DARB-1");
  });
});

describe("EmailInfoRow", () => {
  it("keeps an LTR value readable inside an RTL email", async () => {
    const html = await render(
      <EmailInfoRow label="الرقم" value="+49 176 23790623" ltrValue />,
    );
    expect(html).toContain("+49 176 23790623");
    expect(html).toContain('dir="ltr"');
  });
});

describe("EmailStatusBadge", () => {
  it("communicates status with a shape marker, not colour alone", async () => {
    const cases: Array<[string, string]> = [
      ["neutral", "•"],
      ["success", "✓"],
      ["warning", "!"],
      ["danger", "×"],
    ];
    for (const [tone, mark] of cases) {
      const html = await render(
        <EmailStatusBadge label={`State ${tone}`} tone={tone as never} />,
      );
      expect(html).toContain(mark);
      expect(html).toContain(`State ${tone}`);
    }
  });
});

describe("EmailFallbackLink", () => {
  it("prints the raw href for clients that strip buttons", async () => {
    const html = await render(
      <EmailFallbackLink href="https://darb.agency/invoice/abc" dir="ltr" />,
    );
    expect(html).toContain("If the button does not work");
    expect(html).toContain("https://darb.agency/invoice/abc");
  });
});
