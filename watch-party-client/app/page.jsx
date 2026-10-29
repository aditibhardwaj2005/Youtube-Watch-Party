"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Video,
  Keyboard,
  Play,
  Users,
  Shield,
  AlertCircle
} from "lucide-react";
import { extractYouTubeId } from "@/lib/youtube";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

export default function Home() {
  const router = useRouter();

  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  const [createName, setCreateName] = useState("");
  const [createVideoUrl, setCreateVideoUrl] = useState("");
  const [createError, setCreateError] = useState("");

  const [joinInput, setJoinInput] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joinError, setJoinError] = useState("");

  const generateRoomId = () => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    setCreateError("");

    if (!createName.trim()) {
      setCreateError("Please enter your name");
      return;
    }

    if (!createVideoUrl.trim()) {
      setCreateError("Please enter a YouTube video link or ID");
      return;
    }

    const videoId = extractYouTubeId(createVideoUrl);
    if (!videoId) {
      setCreateError("Please enter a valid YouTube video link or ID");
      return;
    }

    const roomId = generateRoomId();
    const userId = "user_" + Math.random().toString(36).substring(2, 9);

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5001";
    try {
      await fetch(`${socketUrl}/api/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, hostId: userId, videoId })
      });
    } catch (err) {
      console.error(err);
    }

    sessionStorage.setItem("wp_username", createName.trim());
    sessionStorage.setItem("wp_userId", userId);
    sessionStorage.setItem("wp_initialVideo", videoId);
    sessionStorage.setItem("wp_room_joined_" + roomId, "true");

    setCreateOpen(false);
    router.push(`/room/${roomId}`);
  };

  const validateRoomCodeOrLink = (input) => {
    const trimmed = (input || "").trim();
    if (!trimmed) {
      return { valid: false, message: "Please enter a room code or invite link" };
    }

    if (trimmed.includes("youtube.com") || trimmed.includes("youtu.be")) {
      return {
        valid: false,
        message: "This is a YouTube link. To watch this, click 'New watch party' instead."
      };
    }

    let code = trimmed;
    if (code.includes("/room/")) {
      const parts = code.split("/room/");
      code = parts[parts.length - 1].split("?")[0].replace("/", "").trim();
    } else if (code.startsWith("http://") || code.startsWith("https://")) {
      try {
        const url = new URL(code);
        const pathParts = url.pathname.split("/").filter(Boolean);
        if (pathParts[0] === "room" && pathParts[1]) {
          code = pathParts[1];
        } else {
          return { valid: false, message: "Please enter a valid WatchParty room link or code" };
        }
      } catch {
        return { valid: false, message: "Invalid room link URL" };
      }
    }

    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(code)) {
      return {
        valid: false,
        message: "Invalid room code. Room codes must be 3-20 letters or numbers."
      };
    }

    return { valid: true, roomId: code };
  };

  const checkRoomExists = async (roomId) => {
    try {
      const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5001";
      const res = await fetch(`${socketUrl}/api/rooms/${encodeURIComponent(roomId)}`);
      return res.ok;
    } catch {
      return false;
    }
  };

  const handleJoinClick = async (e) => {
    e.preventDefault();
    const validation = validateRoomCodeOrLink(joinInput);
    if (!validation.valid) {
      toast.error(validation.message);
      return;
    }

    const exists = await checkRoomExists(validation.roomId);
    if (!exists) {
      toast.error("Invalid room code or link. Room not found.");
      return;
    }

    const savedName = sessionStorage.getItem("wp_username");
    if (savedName) {
      const userId = sessionStorage.getItem("wp_userId") || "user_" + Math.random().toString(36).substring(2, 9);
      sessionStorage.setItem("wp_userId", userId);
      sessionStorage.removeItem("wp_initialVideo");
      sessionStorage.setItem("wp_room_joined_" + validation.roomId, "true");
      router.push(`/room/${validation.roomId}`);
    } else {
      setJoinOpen(true);
    }
  };

  const handleJoinSubmit = async (e) => {
    e.preventDefault();
    setJoinError("");

    if (!joinName.trim()) {
      setJoinError("Please enter your name to join");
      return;
    }

    const validation = validateRoomCodeOrLink(joinInput);
    if (!validation.valid) {
      toast.error(validation.message);
      setJoinOpen(false);
      return;
    }

    const exists = await checkRoomExists(validation.roomId);
    if (!exists) {
      toast.error("Invalid room code or link. Room not found.");
      setJoinOpen(false);
      return;
    }

    const userId = "user_" + Math.random().toString(36).substring(2, 9);
    sessionStorage.setItem("wp_username", joinName.trim());
    sessionStorage.setItem("wp_userId", userId);
    sessionStorage.removeItem("wp_initialVideo");
    sessionStorage.setItem("wp_room_joined_" + validation.roomId, "true");

    setJoinOpen(false);
    router.push(`/room/${validation.roomId}`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto w-full h-16 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push("/")}>
            <div className="size-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
              <Video className="size-5" />
            </div>
            <span className="font-medium text-lg text-foreground tracking-tight">
              WatchParty
            </span>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto w-full px-6 py-12 flex-1 flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-16">
        <div className="flex-1 flex flex-col gap-6 max-w-xl">
          <div className="flex flex-col gap-3">
            <h1 className="text-4xl sm:text-5xl font-normal tracking-tight text-foreground text-balance leading-tight">
              Video watch parties for everyone
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg leading-relaxed text-balance">
              Connect, synchronize YouTube playback, and enjoy your favorite videos together in real time with live chat.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
            <Button
              size="lg"
              onClick={() => {
                setCreateError("");
                setCreateOpen(true);
              }}
              className="gap-2.5 h-12 px-6 rounded-lg font-medium shadow-sm"
            >
              <Video data-icon="inline-start" className="size-5" />
              New watch party
            </Button>

            <form onSubmit={handleJoinClick} className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-64">
                <Keyboard className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Enter a code or link"
                  value={joinInput}
                  onChange={(e) => setJoinInput(e.target.value)}
                  className="pl-9 h-12 rounded-lg bg-background"
                />
              </div>

              <Button
                type="submit"
                variant="ghost"
                disabled={!joinInput.trim()}
                className="h-12 font-medium px-4"
              >
                Join
              </Button>
            </form>
          </div>
        </div>

        <div className="flex-1 w-full max-w-md flex flex-col items-center">
          <Card className="w-full border-border bg-card shadow-lg overflow-hidden">
            <CardContent className="p-8 flex flex-col items-center text-center gap-6">
              <div className="size-28 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Play className="size-12 text-primary fill-current translate-x-1" />
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="text-lg font-medium text-foreground">
                  Real-time Synchronized Streams
                </h3>
                <p className="text-sm text-muted-foreground text-balance">
                  Click <strong>New watch party</strong> to start a private session, or paste a room code to join friends.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Badge variant="secondary" className="gap-1 text-xs py-1 px-3">
                  <Users className="size-3 text-primary" />
                  Live Chat
                </Badge>
                <Badge variant="secondary" className="gap-1 text-xs py-1 px-3">
                  <Shield className="size-3 text-primary" />
                  Host Controls
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              Start a Watch Party
            </DialogTitle>
            <DialogDescription>
              Enter your display name and a YouTube video to create your room.
            </DialogDescription>
          </DialogHeader>

          {createError && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{createError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleCreateRoom} className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="create-name">Your Name</FieldLabel>
                <Input
                  id="create-name"
                  type="text"
                  placeholder="e.g. Alex"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  autoFocus
                  required
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="create-url">YouTube Video Link or ID</FieldLabel>
                <Input
                  id="create-url"
                  type="text"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={createVideoUrl}
                  onChange={(e) => setCreateVideoUrl(e.target.value)}
                  required
                />
              </Field>
            </FieldGroup>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="default"
                className="font-medium"
              >
                Create room
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Users className="size-5 text-primary" />
              Join Watch Party
            </DialogTitle>
            <DialogDescription>
              Enter your display name to join the room.
            </DialogDescription>
          </DialogHeader>

          {joinError && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{joinError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleJoinSubmit} className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="join-name-modal">Your Name</FieldLabel>
                <Input
                  id="join-name-modal"
                  type="text"
                  placeholder="e.g. Jordan"
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  autoFocus
                  required
                />
              </Field>
            </FieldGroup>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setJoinOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="default"
                className="font-medium"
              >
                Join room
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
