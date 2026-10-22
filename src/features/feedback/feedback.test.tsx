import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ImageManipulator } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import type { ReactElement } from "react";
import { Linking } from "react-native";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FeedbackButton } from "./FeedbackButton";
import { FeedbackImagePicker } from "./FeedbackImagePicker";
import { MAX_SCREENSHOT_EDGE, prepareScreenshot } from "./prepareScreenshot";

const data = vi.hoisted(() => ({ submitFeedbackReport: vi.fn(), uploadContentImage: vi.fn() }));
const supabase = vi.hoisted(() => ({}));

vi.mock("@slay/data", () => data);
vi.mock("~/lib/supabase", () => ({ supabase, supabaseUrl: "https://x.supabase.co" }));

afterEach(() => {
  vi.clearAllMocks();
  vi.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockReset().mockResolvedValue({ granted: true, canAskAgain: true } as never);
  vi.unstubAllGlobals();
});

function withQueries(ui: ReactElement) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>{ui}</QueryClientProvider>);
}

const asset = (uri: string, width = 1170, height = 2532) => ({ uri, width, height });

describe("FeedbackButton", () => {
  const openSheet = () => fireEvent.click(screen.getByRole("button", { name: "Feedback & Bugs" }));

  it("sends a report and thanks the student", async () => {
    data.submitFeedbackReport.mockResolvedValue({ ok: true });
    withQueries(<FeedbackButton />);
    openSheet();

    const send = screen.getByRole("button", { name: "Send report" });
    expect(send.getAttribute("aria-disabled")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Feedback" }));
    expect(screen.getByPlaceholderText("What would make SLAY CITY better?")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("What happened?"), { target: { value: "More hats please" } });
    expect(screen.getByText("16/4000")).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Send report" })));

    expect(data.submitFeedbackReport).toHaveBeenCalledWith(
      supabase,
      { kind: "feedback", message: "More hats please", imageUrls: [] },
      "https://x.supabase.co",
    );
    expect(await screen.findByText("Thanks — we got it!")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByText("Thanks — we got it!")).toBeNull();
  });

  it("shows why a report was refused", async () => {
    data.submitFeedbackReport.mockResolvedValue({ ok: false, error: "Only students and teachers can send reports." });
    withQueries(<FeedbackButton />);
    openSheet();
    fireEvent.change(screen.getByLabelText("What happened?"), { target: { value: "The map froze" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Send report" })));
    expect((await screen.findByRole("alert")).textContent).toBe("Only students and teachers can send reports.");
  });

  it("starts from a blank draft each time it opens", () => {
    withQueries(<FeedbackButton />);
    openSheet();
    fireEvent.change(screen.getByLabelText("What happened?"), { target: { value: "draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    openSheet();
    expect((screen.getByLabelText("What happened?") as HTMLTextAreaElement).value).toBe("");
  });
});

describe("FeedbackImagePicker", () => {
  it("compresses and uploads each picked image to feedback/, then shows it", async () => {
    vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [asset("file:///a.heic"), asset("file:///b.png")],
    } as never);
    const saveAsync = vi.fn(async () => ({ uri: "file:///small.jpg" }));
    vi.mocked(ImageManipulator.manipulate).mockReturnValue({ resize: vi.fn(), renderAsync: async () => ({ saveAsync }) } as never);
    vi.stubGlobal("fetch", vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(8) })));
    data.uploadContentImage.mockImplementation(async (_db, folder: string) => `https://x.supabase.co/storage/v1/object/public/content/${folder}/${data.uploadContentImage.mock.calls.length}.jpg`);
    const onChange = vi.fn();

    render(<FeedbackImagePicker value={[]} onChange={onChange} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Add screenshot" })));

    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(expect.objectContaining({ allowsMultipleSelection: true, selectionLimit: 5 }));
    expect(data.uploadContentImage).toHaveBeenCalledWith(supabase, "feedback", {
      body: expect.any(ArrayBuffer),
      contentType: "image/jpeg",
      ext: "jpg",
      id: "uuid",
    });
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith([
        "https://x.supabase.co/storage/v1/object/public/content/feedback/1.jpg",
        "https://x.supabase.co/storage/v1/object/public/content/feedback/2.jpg",
      ]),
    );
  });

  it("removes a screenshot and hides Add once five are attached", () => {
    const urls = ["u1", "u2", "u3", "u4", "u5"];
    const onChange = vi.fn();
    render(<FeedbackImagePicker value={urls} onChange={onChange} />);
    expect(screen.queryByRole("button", { name: "Add screenshot" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Remove screenshot 2" }));
    expect(onChange).toHaveBeenCalledWith(["u1", "u3", "u4", "u5"]);
  });

  it("explains a refused photo permission and offers Settings once the system won't ask again", async () => {
    vi.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValueOnce({ granted: false, canAskAgain: false } as never);
    // react-native-web has no Settings app to open.
    const openSettings = vi.fn(async () => {});
    Object.assign(Linking, { openSettings });
    render(<FeedbackImagePicker value={[]} onChange={vi.fn()} />);

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Add screenshot" })));
    expect(screen.getByRole("alert").textContent).toMatch(/needs access to your photos/);
    expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Open Settings" }));
    expect(openSettings).toHaveBeenCalled();
  });

  it("doesn't offer Settings while the system can still ask", async () => {
    vi.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValueOnce({ granted: false, canAskAgain: true } as never);
    render(<FeedbackImagePicker value={[]} onChange={vi.fn()} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Add screenshot" })));
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Open Settings" })).toBeNull();
  });

  it("says when an upload failed", async () => {
    vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({ canceled: false, assets: [asset("file:///a.jpg")] } as never);
    vi.mocked(ImageManipulator.manipulate).mockReturnValue({
      resize: vi.fn(),
      renderAsync: async () => ({ saveAsync: async () => ({ uri: "file:///a2.jpg" }) }),
    } as never);
    vi.stubGlobal("fetch", vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(8) })));
    data.uploadContentImage.mockRejectedValue(new Error("The object exceeded the maximum allowed size"));
    const onChange = vi.fn();
    render(<FeedbackImagePicker value={[]} onChange={onChange} />);

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Add screenshot" })));
    expect((await screen.findByRole("alert")).textContent).toBe("The object exceeded the maximum allowed size");
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("prepareScreenshot", () => {
  function manipulator() {
    const saveAsync = vi.fn(async () => ({ uri: "file:///out.jpg" }));
    const context = { resize: vi.fn(), renderAsync: vi.fn(async () => ({ saveAsync })) };
    vi.mocked(ImageManipulator.manipulate).mockReturnValue(context as never);
    vi.stubGlobal("fetch", vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(3) })));
    return { context, saveAsync };
  }

  it("shrinks a tall photo to the maximum edge and re-encodes it as JPEG", async () => {
    const { context, saveAsync } = manipulator();
    const result = await prepareScreenshot(asset("file:///in.heic", 3024, 4032));
    expect(context.resize).toHaveBeenCalledWith({ height: MAX_SCREENSHOT_EDGE });
    expect(saveAsync).toHaveBeenCalledWith({ compress: 0.7, format: "jpeg" });
    expect(result).toEqual({ body: expect.any(ArrayBuffer), contentType: "image/jpeg", ext: "jpg" });
  });

  it("shrinks a wide one by its width", async () => {
    const { context } = manipulator();
    await prepareScreenshot(asset("file:///in.png", 4000, 3000));
    expect(context.resize).toHaveBeenCalledWith({ width: MAX_SCREENSHOT_EDGE });
  });

  it("leaves a small image's size alone but still re-encodes it", async () => {
    const { context, saveAsync } = manipulator();
    await prepareScreenshot(asset("file:///in.png", 800, 600));
    expect(context.resize).not.toHaveBeenCalled();
    expect(saveAsync).toHaveBeenCalled();
  });
});
