"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Users,
  MessageSquare,
  Shield,
  Crown,
  UserCheck,
  UserX,
  Link as LinkIcon,
  Check,
  LogOut,
  Send,
  Video,
  Sparkles,
  RefreshCw,
  MoreVertical,
  Maximize2,
  Minimize2,
  AlertCircle
} from "lucide-react";
import { getSocket } from "@/lib/socket";
import { extractYouTubeId, formatTime } from "@/lib/youtube";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";

const REACTION_EMOJIS = ["🔥", "❤️", "😂", "🎉", "👏", "🚀"];

function RoomContent() {
  const params = useParams();
  const roomId = params?.roomId || "";
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [userId, setUserId] = useState("");
  const [myRole, setMyRole] = useState("participant");
  const [connected, setConnected] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [currentVideoId, setCurrentVideoId] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("wp_initialVideo") || "";
    }
    return "";
  });
  const [playState, setPlayState] = useState("paused");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);

  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [activeTab, setActiveTab] = useState("chat");
  const [reactions, setReactions] = useState([]);

  const [copiedLink, setCopiedLink] = useState(false);
  const [showChangeVideoModal, setShowChangeVideoModal] = useState(false);
  const [newVideoInput, setNewVideoInput] = useState("");
  const [isMaximized, setIsMaximized] = useState(false);
  const [showOverlayControls, setShowOverlayControls] = useState(true);

  const [hasJoined, setHasJoined] = useState(() => {
    if (typeof window !== "undefined") {
      return Boolean(
        sessionStorage.getItem("wp_room_joined_" + roomId) &&
        sessionStorage.getItem("wp_username")
      );
    }
    return false;
  });
  const [showJoinDialog, setShowJoinDialog] = useState(() => {
    if (typeof window !== "undefined") {
      return !Boolean(
        sessionStorage.getItem("wp_room_joined_" + roomId) &&
        sessionStorage.getItem("wp_username")
      );
    }
    return true;
  });
  const [joinNameInput, setJoinNameInput] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("wp_username");
      if (saved && !saved.startsWith("User_")) {
        return saved;
      }
    }
    return "";
  });
  const [joinError, setJoinError] = useState("");

  const videoContainerRef = useRef(null);
  const playerRef = useRef(null);
  const isPlayerReadyRef = useRef(false);
  const isProgrammaticUpdateRef = useRef(false);
  const chatBottomRef = useRef(null);
  const timeUpdateIntervalRef = useRef(null);
  const overlayTimeoutRef = useRef(null);
  const currentVideoIdRef = useRef(currentVideoId);
  currentVideoIdRef.current = currentVideoId;
  const playStateRef = useRef(playState);
  playStateRef.current = playState;

  const showNotice = (msg, type = "info") => {
    if (type === "error") {
      toast.error(msg);
    } else if (type === "success") {
      toast.success(msg);
    } else {
      toast.info(msg);
    }
  };

  const handleDirectJoinSubmit = (e) => {
    e.preventDefault();
    const trimmed = joinNameInput.trim();
    if (!trimmed) {
      setJoinError("Please enter your name to join");
      return;
    }

    let storedId = sessionStorage.getItem("wp_userId");
    if (!storedId) {
      storedId = "user_" + Math.random().toString(36).substring(2, 9);
      sessionStorage.setItem("wp_userId", storedId);
    }

    sessionStorage.setItem("wp_username", trimmed);
    sessionStorage.setItem("wp_room_joined_" + roomId, "true");
    setUsername(trimmed);
    setUserId(storedId);
    setJoinError("");
    setShowJoinDialog(false);
    setHasJoined(true);
  };

  useEffect(() => {
    if (!hasJoined || !roomId) return;

    let storedName = sessionStorage.getItem("wp_username") || username;
    let storedId = sessionStorage.getItem("wp_userId") || userId;
    const storedInitialVideo = sessionStorage.getItem("wp_initialVideo");

    if (!storedId) {
      storedId = "user_" + Math.random().toString(36).substring(2, 9);
      sessionStorage.setItem("wp_userId", storedId);
    }
    if (!storedName) {
      storedName = "Guest";
      sessionStorage.setItem("wp_username", storedName);
    }

    setUsername(storedName);
    setUserId(storedId);

    const socket = getSocket();
    socket.connect();

    const handleConnect = () => {
      setConnected(true);
      socket.emit("join_room", {
        roomId,
        username: storedName,
        userId: storedId,
        initialVideoId: storedInitialVideo || ""
      });
    };

    const handleJoinedSuccessfully = (data) => {
      setMyRole(data.role);
      setParticipants(data.participants);
      if (data.syncState) {
        applySyncState(data.syncState);
      }
    };

    const handleSyncState = (state) => {
      applySyncState(state);
    };

    const handleUserJoined = (data) => {
      setParticipants(data.participants);
      showNotice(`${data.username} joined the party`, "info");
    };

    const handleUserLeft = (data) => {
      setParticipants(data.participants);
      if (data.username) {
        showNotice(`${data.username} left`, "info");
      }
    };

    const handleRoleAssigned = (data) => {
      setParticipants(data.participants);
      if (data.targetUserId === storedId) {
        setMyRole(data.role);
        showNotice(`Your role was updated to: ${data.role.toUpperCase()}`, "success");
      } else {
        showNotice(`Role updated: ${data.username || "Participant"} is now ${data.role}`, "info");
      }
    };

    const handleParticipantRemoved = (data) => {
      if (data.targetUserId === storedId) {
        alert("You have been removed from this room by the host.");
        router.push("/");
        return;
      }
      setParticipants(data.participants);
      showNotice("A participant was removed by host", "info");
    };

    const handleNewChat = (chat) => {
      setChatMessages((prev) => [...prev, chat]);
    };

    const handleChatHistory = (history) => {
      if (Array.isArray(history)) {
        setChatMessages(history);
      }
    };

    const handleNewReaction = (reaction) => {
      setReactions((prev) => [...prev, reaction]);
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== reaction.id));
      }, 2500);
    };

    const handleErrorMessage = (err) => {
      showNotice(err.message, "error");
      if (err.message && err.message.toLowerCase().includes("not found")) {
        sessionStorage.removeItem("wp_room_joined_" + roomId);
        setTimeout(() => {
          router.push("/");
        }, 1500);
      }
    };

    socket.on("connect", handleConnect);
    socket.on("joined_successfully", handleJoinedSuccessfully);
    socket.on("sync_state", handleSyncState);
    socket.on("user_joined", handleUserJoined);
    socket.on("user_left", handleUserLeft);
    socket.on("role_assigned", handleRoleAssigned);
    socket.on("participant_removed", handleParticipantRemoved);
    socket.on("new_chat", handleNewChat);
    socket.on("chat_history", handleChatHistory);
    socket.on("new_reaction", handleNewReaction);
    socket.on("error_message", handleErrorMessage);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.emit("leave_room", { roomId });
      socket.off("connect", handleConnect);
      socket.off("joined_successfully", handleJoinedSuccessfully);
      socket.off("sync_state", handleSyncState);
      socket.off("user_joined", handleUserJoined);
      socket.off("user_left", handleUserLeft);
      socket.off("role_assigned", handleRoleAssigned);
      socket.off("participant_removed", handleParticipantRemoved);
      socket.off("new_chat", handleNewChat);
      socket.off("chat_history", handleChatHistory);
      socket.off("new_reaction", handleNewReaction);
      socket.off("error_message", handleErrorMessage);
    };
  }, [roomId, hasJoined]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  useEffect(() => {
    let tag = document.getElementById("yt-iframe-api");
    if (!tag) {
      tag = document.createElement("script");
      tag.id = "yt-iframe-api";
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }

    window.onYouTubeIframeAPIReady = () => {
      if (currentVideoIdRef.current) {
        initPlayer(currentVideoIdRef.current);
      }
    };

    if (window.YT && window.YT.Player && currentVideoIdRef.current) {
      initPlayer(currentVideoIdRef.current);
    }

    return () => {
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
      }
    };
  }, []);

  const initPlayer = (videoId) => {
    if (!videoId) return;
    if (playerRef.current) return;

    playerRef.current = new window.YT.Player("youtube-player-element", {
      height: "100%",
      width: "100%",
      videoId: videoId,
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        enablejsapi: 1,
        modestbranding: 1,
        rel: 0,
        origin: window.location.origin
      },
      events: {
        onReady: (event) => {
          isPlayerReadyRef.current = true;
          event.target.setVolume(80);
          event.target.pauseVideo();
          setDuration(event.target.getDuration() || 0);

          if (timeUpdateIntervalRef.current) clearInterval(timeUpdateIntervalRef.current);
          timeUpdateIntervalRef.current = setInterval(() => {
            if (playerRef.current && playerRef.current.getCurrentTime) {
              const cur = playerRef.current.getCurrentTime();
              setCurrentTime(cur);
              const dur = playerRef.current.getDuration();
              if (dur && dur !== duration) setDuration(dur);
            }
          }, 500);
        },
        onStateChange: (event) => {
          if (event.data === window.YT.PlayerState.PLAYING) {
            setPlayState("playing");
          } else if (event.data === window.YT.PlayerState.PAUSED) {
            setPlayState("paused");
          }
        }
      }
    });
  };

  const applySyncState = (state) => {
    if (!state) return;
    const { videoId, playState: incomingState, currentTime: serverCurrentTime, serverTime } = state;

    if (videoId) {
      const prevVideoId = currentVideoIdRef.current;
      if (videoId !== prevVideoId) {
        setCurrentVideoId(videoId);
      }

      if (!playerRef.current) {
        if (typeof window !== "undefined" && window.YT && window.YT.Player) {
          initPlayer(videoId);
        }
        return;
      }

      if (playerRef.current && isPlayerReadyRef.current && videoId !== prevVideoId) {
        isProgrammaticUpdateRef.current = true;
        playerRef.current.loadVideoById(videoId, serverCurrentTime || 0);
        if (incomingState === "playing") {
          playerRef.current.playVideo();
        } else {
          playerRef.current.pauseVideo();
        }
        setTimeout(() => {
          isProgrammaticUpdateRef.current = false;
        }, 1000);
        return;
      }
    }

    if (!playerRef.current || !isPlayerReadyRef.current) return;

    let targetTime = serverCurrentTime || 0;
    if (incomingState === "playing" && serverTime) {
      const elapsed = (Date.now() - serverTime) / 1000;
      targetTime = Math.max(0, targetTime + elapsed);
    }

    const localTime = playerRef.current.getCurrentTime ? playerRef.current.getCurrentTime() : 0;
    const drift = Math.abs(localTime - targetTime);

    isProgrammaticUpdateRef.current = true;

    if (drift > 1.5) {
      playerRef.current.seekTo(targetTime, true);
    }

    if (incomingState === "playing") {
      playerRef.current.playVideo();
      setPlayState("playing");
    } else {
      playerRef.current.pauseVideo();
      setPlayState("paused");
    }

    setTimeout(() => {
      isProgrammaticUpdateRef.current = false;
    }, 600);
  };

  const canControl = myRole === "host" || myRole === "moderator";

  const handleTogglePlay = () => {
    if (!canControl) {
      showNotice("Only Host and Moderators can control playback", "error");
      return;
    }

    const socket = getSocket();
    const cur = (playerRef.current && playerRef.current.getCurrentTime)
      ? playerRef.current.getCurrentTime()
      : currentTime;

    if (playStateRef.current === "playing") {
      socket.emit("pause", { roomId, currentTime: cur });
    } else {
      socket.emit("play", { roomId, currentTime: cur });
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        if (videoContainerRef.current) {
          if (videoContainerRef.current.requestFullscreen) {
            await videoContainerRef.current.requestFullscreen();
          } else if (videoContainerRef.current.webkitRequestFullscreen) {
            await videoContainerRef.current.webkitRequestFullscreen();
          } else if (videoContainerRef.current.msRequestFullscreen) {
            await videoContainerRef.current.msRequestFullscreen();
          }
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        }
      }
    } catch {
      setIsMaximized((prev) => !prev);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
      setIsMaximized(isFull);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === "Space") {
        const activeTag = document.activeElement?.tagName?.toLowerCase();
        if (activeTag === "input" || activeTag === "textarea" || document.activeElement?.isContentEditable) {
          return;
        }
        e.preventDefault();
        handleTogglePlay();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [canControl]);

  const handleMouseMove = () => {
    setShowOverlayControls(true);
    if (overlayTimeoutRef.current) {
      clearTimeout(overlayTimeoutRef.current);
    }
    if (isMaximized && playStateRef.current === "playing") {
      overlayTimeoutRef.current = setTimeout(() => {
        setShowOverlayControls(false);
      }, 3000);
    }
  };

  const handleVideoContainerClick = (e) => {
    if (e.target.closest("button") || e.target.closest("input") || e.target.closest("[role='slider']")) {
      return;
    }
    setShowOverlayControls(true);
    if (canControl) {
      handleTogglePlay();
    } else {
      showNotice("Only Host and Moderators can control playback", "error");
    }
  };

  const handleSeek = (newTime) => {
    if (!canControl) {
      showNotice("Only Host and Moderators can scrub playback", "error");
      return;
    }

    const socket = getSocket();
    socket.emit("seek", { roomId, time: newTime });
  };

  const handleSkip = (seconds) => {
    if (!canControl) {
      showNotice("Only Host and Moderators can skip playback", "error");
      return;
    }

    const cur = playerRef.current?.getCurrentTime() || currentTime;
    const newTime = Math.max(0, Math.min(duration, cur + seconds));
    handleSeek(newTime);
  };

  const handleChangeVideoSubmit = (e) => {
    e.preventDefault();
    if (!canControl) {
      showNotice("Only Host and Moderators can change video", "error");
      return;
    }

    const extractedId = extractYouTubeId(newVideoInput);
    if (!extractedId) {
      showNotice("Please enter a valid YouTube link or ID", "error");
      return;
    }

    const socket = getSocket();
    socket.emit("change_video", { roomId, videoId: extractedId });
    setShowChangeVideoModal(false);
    setNewVideoInput("");
    showNotice("Video changed for everyone in the room", "success");
  };

  const handleVolumeChange = (newVol) => {
    setVolume(newVol);
    if (playerRef.current && isPlayerReadyRef.current) {
      playerRef.current.setVolume(newVol);
      if (newVol > 0 && isMuted) {
        playerRef.current.unMute();
        setIsMuted(false);
      }
    }
  };

  const handleToggleMute = () => {
    if (!playerRef.current || !isPlayerReadyRef.current) return;
    if (isMuted) {
      playerRef.current.unMute();
      setIsMuted(false);
    } else {
      playerRef.current.mute();
      setIsMuted(true);
    }
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const socket = getSocket();
    socket.emit("send_chat", { roomId, message: chatInput });
    setChatInput("");
  };

  const handleSendReaction = (emoji) => {
    const socket = getSocket();
    socket.emit("send_reaction", { roomId, emoji });
  };

  const handleAssignRole = (targetUserId, newRole) => {
    if (myRole !== "host") return;
    const socket = getSocket();
    socket.emit("assign_role", { roomId, targetUserId, role: newRole });
  };

  const handleTransferHost = (newHostUserId) => {
    if (myRole !== "host") return;
    if (confirm("Are you sure you want to transfer host permissions? You will become a Moderator.")) {
      const socket = getSocket();
      socket.emit("transfer_host", { roomId, newHostUserId });
    }
  };

  const handleRemoveParticipant = (targetUserId) => {
    if (myRole !== "host") return;
    if (confirm("Are you sure you want to remove this participant?")) {
      const socket = getSocket();
      socket.emit("remove_participant", { roomId, targetUserId });
    }
  };

  const handleManualCatchUp = () => {
    const socket = getSocket();
    socket.emit("join_room", { roomId, username, userId });
    showNotice("Re-synced with server!", "success");
  };

  const copyRoomLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      toast.success("Room link copied to clipboard");
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const renderRoleBadge = (role) => {
    switch (role) {
      case "host":
        return (
          <Badge variant="default" className="gap-1 text-[11px] font-medium">
            <Crown className="size-3 fill-current" />
            Host
          </Badge>
        );
      case "moderator":
        return (
          <Badge variant="secondary" className="gap-1 text-[11px] font-medium">
            <Shield className="size-3" />
            Moderator
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1 text-[11px] font-medium text-muted-foreground">
            Participant
          </Badge>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      <header className="border-b border-border">
        <div className="w-full h-16 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => {
              sessionStorage.removeItem("wp_room_joined_" + roomId);
              router.push("/");
            }}>
              <div className="size-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
                <Video className="size-5" />
              </div>
              <span className="font-medium text-lg text-foreground tracking-tight">
                WatchParty
              </span>
            </div>

            <Separator orientation="vertical" className="h-5 hidden sm:block" />

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium hidden xs:inline">Room:</span>
              <Badge variant="secondary" className="font-mono text-xs gap-1.5 py-1 px-2.5">
                <span className="font-semibold tracking-wider">{roomId}</span>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={copyRoomLink}
                        className="size-5 rounded-sm hover:bg-muted"
                      />
                    }
                  >
                    {copiedLink ? <Check className="size-3 text-primary" /> : <LinkIcon className="size-3" />}
                  </TooltipTrigger>
                  <TooltipContent>
                    {copiedLink ? "Copied!" : "Copy room link"}
                  </TooltipContent>
                </Tooltip>
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`size-2 rounded-full ${connected ? "bg-primary animate-pulse" : "bg-destructive"}`}
                title={connected ? "Connected" : "Disconnected"}
              />
              <span className="text-xs text-muted-foreground hidden md:inline">
                {connected ? "Connected" : "Reconnecting..."}
              </span>
            </div>

            <Separator orientation="vertical" className="h-5" />

            <div className="flex items-center gap-2">
              <Avatar className="size-8">
                <AvatarFallback className="text-xs font-semibold bg-muted text-foreground">
                  {username ? username.charAt(0).toUpperCase() : "U"}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs font-medium max-w-[100px] truncate">{username}</span>
              {renderRoleBadge(myRole)}
            </div>

            <Separator orientation="vertical" className="h-5 hidden sm:block" />

            <ThemeToggle />

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      sessionStorage.removeItem("wp_room_joined_" + roomId);
                      router.push("/");
                    }}
                    className="size-9 rounded-lg hover:text-destructive hover:bg-destructive/10"
                  />
                }
              >
                <LogOut className="size-4" />
              </TooltipTrigger>
              <TooltipContent>Leave Room</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </header>

      <main className="w-full px-6 py-8 flex-1 flex flex-col lg:flex-row gap-6">
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <div
            ref={videoContainerRef}
            onClick={handleVideoContainerClick}
            onMouseMove={handleMouseMove}
            onDoubleClick={(e) => {
              e.stopPropagation();
              toggleFullscreen();
            }}
            className={`group/player relative w-full bg-black flex items-center justify-center overflow-hidden select-none transition-all duration-300 ${isMaximized
              ? "fixed inset-0 z-50 h-screen w-screen rounded-none cursor-default"
              : "aspect-video rounded-2xl border border-border shadow-sm cursor-pointer"
              }`}
          >
            <div className={`size-full flex items-center justify-center ${isMaximized ? "max-h-screen max-w-full aspect-video" : ""}`}>
              <div id="youtube-player-element" className="size-full pointer-events-none"></div>
            </div>

            {isMaximized && playState === "paused" && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="size-20 rounded-full bg-background/85 text-foreground backdrop-blur-md flex items-center justify-center shadow-2xl border border-white/20">
                  <Play className="size-10 fill-current translate-x-1" />
                </div>
              </div>
            )}

            <div
              className={`absolute top-4 left-4 flex items-center gap-2 transition-opacity duration-300 ${isMaximized && !showOverlayControls && playState === "playing"
                ? "opacity-0 pointer-events-none"
                : "opacity-100"
                }`}
            >
              <Badge variant="secondary" className="bg-background/80 backdrop-blur-md gap-1.5 py-1 px-3 text-xs shadow-sm">
                <span className={`size-2 rounded-full ${canControl ? "bg-emerald-500" : "bg-primary animate-pulse"}`}></span>
                {canControl ? "Host Controls Active" : "In Sync with Host"}
              </Badge>
            </div>

            <div
              className={`absolute top-4 right-4 flex items-center gap-2 transition-opacity duration-300 ${isMaximized && !showOverlayControls && playState === "playing"
                ? "opacity-0 pointer-events-none"
                : "opacity-100"
                }`}
            >
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFullscreen();
                      }}
                      className="bg-background/85 hover:bg-background backdrop-blur-md gap-1.5 py-1 px-2.5 text-xs h-8 shadow-sm rounded-lg font-medium border border-border"
                    />
                  }
                >
                  {isMaximized ? (
                    <>
                      <Minimize2 className="size-3.5" />
                      <span className="hidden xs:inline">Exit Fullscreen</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="size-3.5" />
                      <span className="hidden xs:inline">Fullscreen</span>
                    </>
                  )}
                </TooltipTrigger>
                <TooltipContent>
                  {isMaximized ? "Exit fullscreen (Esc)" : "Maximize to fullscreen"}
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {reactions.map((react) => (
                <div
                  key={react.id}
                  className="absolute bottom-16 left-1/2 -translate-x-1/2 animate-float-up text-4xl select-none"
                  style={{
                    left: `${40 + Math.random() * 20}%`
                  }}
                >
                  {react.emoji}
                </div>
              ))}
            </div>

            {isMaximized && (
              <div
                onClick={(e) => e.stopPropagation()}
                className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-4 sm:p-6 flex flex-col gap-3 transition-opacity duration-300 ${!showOverlayControls && playState === "playing"
                  ? "opacity-0 pointer-events-none"
                  : "opacity-100"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-white/90 w-12 text-right tabular-nums">
                    {formatTime(currentTime)}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    value={currentTime}
                    disabled={!canControl}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setCurrentTime(val);
                    }}
                    onMouseUp={(e) => {
                      if (canControl) {
                        handleSeek(parseFloat(e.target.value));
                      }
                    }}
                    onTouchEnd={(e) => {
                      if (canControl) {
                        handleSeek(parseFloat(e.target.value));
                      }
                    }}
                    className={`flex-1 h-2 rounded-full appearance-none cursor-pointer transition ${canControl
                      ? "bg-white/30 accent-primary hover:h-2.5"
                      : "bg-white/20 accent-white/40 cursor-not-allowed opacity-60"
                      }`}
                  />
                  <span className="text-xs font-mono text-white/90 w-12 tabular-nums">
                    {formatTime(duration)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant={canControl ? (playState === "playing" ? "secondary" : "default") : "secondary"}
                      size="icon"
                      disabled={!canControl}
                      onClick={handleTogglePlay}
                      className="size-9 rounded-lg shadow-sm"
                      title={canControl ? (playState === "playing" ? "Pause for room" : "Play for room") : "Playback controlled by Host & Moderator"}
                    >
                      {playState === "playing" ? (
                        <Pause className="size-4 fill-current" />
                      ) : (
                        <Play className="size-4 fill-current translate-x-0.5" />
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      disabled={!canControl}
                      onClick={() => handleSkip(-10)}
                      className="size-8 rounded-lg bg-white/10 hover:bg-white/20 text-white border-0"
                      title="Rewind 10s"
                    >
                      <RotateCcw className="size-3.5" />
                    </Button>

                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      disabled={!canControl}
                      onClick={() => handleSkip(10)}
                      className="size-8 rounded-lg bg-white/10 hover:bg-white/20 text-white border-0"
                      title="Forward 10s"
                    >
                      <RotateCw className="size-3.5" />
                    </Button>

                    <div className="h-4 w-px bg-white/20 mx-1 hidden sm:block" />

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={handleToggleMute}
                      className="size-8 rounded-lg text-white hover:bg-white/20"
                      title={isMuted ? "Unmute" : "Mute"}
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX className="size-4" />
                      ) : (
                        <Volume2 className="size-4" />
                      )}
                    </Button>

                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={isMuted ? 0 : volume}
                      onChange={(e) => handleVolumeChange(parseInt(e.target.value, 10))}
                      className="w-16 sm:w-24 h-1.5 bg-white/30 rounded-full appearance-none cursor-pointer accent-primary"
                      title="Volume"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="hidden sm:flex items-center gap-1.5 mr-2">
                      {REACTION_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => handleSendReaction(emoji)}
                          className="size-7 rounded hover:bg-white/20 text-base active:scale-95 transition-transform flex items-center justify-center"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>

                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      onClick={toggleFullscreen}
                      className="size-8 rounded-lg bg-white/10 hover:bg-white/20 text-white border-0"
                      title="Exit Fullscreen"
                    >
                      <Minimize2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <Card className="border-border bg-card shadow-sm py-0">
            <CardContent className="p-4 sm:p-5 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-muted-foreground w-12 text-right tabular-nums">
                  {formatTime(currentTime)}
                </span>

                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={currentTime}
                  disabled={!canControl}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setCurrentTime(val);
                  }}
                  onMouseUp={(e) => {
                    if (canControl) {
                      handleSeek(parseFloat(e.target.value));
                    }
                  }}
                  onTouchEnd={(e) => {
                    if (canControl) {
                      handleSeek(parseFloat(e.target.value));
                    }
                  }}
                  className={`flex-1 h-2 rounded-full appearance-none cursor-pointer transition ${canControl
                    ? "bg-muted accent-primary hover:h-2.5"
                    : "bg-muted/40 accent-muted cursor-not-allowed opacity-60"
                    }`}
                />

                <span className="text-xs font-mono text-muted-foreground w-12 tabular-nums">
                  {formatTime(duration)}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant={canControl ? (playState === "playing" ? "secondary" : "default") : "secondary"}
                          size="icon"
                          disabled={!canControl}
                          onClick={handleTogglePlay}
                          className="size-10 rounded-lg shadow-sm"
                        />
                      }
                    >
                      {playState === "playing" ? (
                        <Pause className="size-5 fill-current" />
                      ) : (
                        <Play className="size-5 fill-current translate-x-0.5" />
                      )}
                    </TooltipTrigger>
                    <TooltipContent>
                      {canControl ? (playState === "playing" ? "Pause" : "Play") : "Controls restricted to Host & Moderator"}
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="outline"
                          size="icon"
                          disabled={!canControl}
                          onClick={() => handleSkip(-10)}
                          className="size-9 rounded-lg"
                        />
                      }
                    >
                      <RotateCcw className="size-4" />
                    </TooltipTrigger>
                    <TooltipContent>Rewind 10 seconds</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="outline"
                          size="icon"
                          disabled={!canControl}
                          onClick={() => handleSkip(10)}
                          className="size-9 rounded-lg"
                        />
                      }
                    >
                      <RotateCw className="size-4" />
                    </TooltipTrigger>
                    <TooltipContent>Forward 10 seconds</TooltipContent>
                  </Tooltip>

                  {canControl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowChangeVideoModal(true)}
                      className="ml-2 gap-1.5 rounded-lg font-medium text-xs"
                    >
                      <Video className="size-3.5 text-primary" />
                      Change Video
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleManualCatchUp}
                    className="gap-1.5 text-xs text-muted-foreground hover:text-foreground rounded-lg font-medium"
                  >
                    <RefreshCw className="size-3 text-primary" />
                    Catch Up
                  </Button>

                  <Separator orientation="vertical" className="h-5" />

                  <div className="flex items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={handleToggleMute}
                            className="size-8 rounded-lg"
                          />
                        }
                      >
                        {isMuted || volume === 0 ? (
                          <VolumeX className="size-4 text-muted-foreground" />
                        ) : (
                          <Volume2 className="size-4" />
                        )}
                      </TooltipTrigger>
                      <TooltipContent>{isMuted ? "Unmute" : "Mute"}</TooltipContent>
                    </Tooltip>

                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={isMuted ? 0 : volume}
                      onChange={(e) => handleVolumeChange(parseInt(e.target.value, 10))}
                      className="w-16 sm:w-20 h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                      title="Volume"
                    />

                    <Separator orientation="vertical" className="h-5" />

                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={toggleFullscreen}
                            className="size-8 rounded-lg"
                            aria-label={isMaximized ? "Exit fullscreen" : "Fullscreen"}
                          />
                        }
                      >
                        {isMaximized ? (
                          <Minimize2 className="size-4" />
                        ) : (
                          <Maximize2 className="size-4" />
                        )}
                      </TooltipTrigger>
                      <TooltipContent>
                        {isMaximized ? "Exit fullscreen (Esc)" : "Fullscreen"}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>

              {!canControl && (
                <div className="p-2.5 rounded-lg bg-muted/30 border border-border text-xs text-muted-foreground flex items-center justify-between">
                  <span>Playback is managed by <strong>Host</strong> & <strong>Moderator</strong>.</span>
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    Auto-synced
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-sm py-0">
            <CardContent className="p-3 sm:p-4 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                {REACTION_EMOJIS.map((emoji) => (
                  <Button
                    key={emoji}
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => handleSendReaction(emoji)}
                    className="size-9 rounded-lg text-lg hover:scale-105 active:scale-95 transition-transform shadow-sm"
                  >
                    {emoji}
                  </Button>
                ))}
              </div>

              {isMaximized && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsMaximized(false)}
                  className="gap-2 font-medium text-xs rounded-lg"
                >
                  <MessageSquare className="size-3.5 text-primary" />
                  Text Friends
                  {chatMessages.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-semibold">
                      {chatMessages.length}
                    </Badge>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {!isMaximized && (
          <div className="w-full lg:w-96 flex flex-col shrink-0 animate-in fade-in-50 duration-200">
            <Card className="border-border bg-card shadow-sm flex flex-col h-[560px] lg:h-[620px] overflow-hidden py-0">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col gap-0">
                <div className="p-3 border-b border-border">
                  <TabsList className="w-full grid grid-cols-2 rounded-lg bg-muted p-1">
                    <TabsTrigger value="chat" className="gap-2 rounded-md text-xs font-medium py-1.5">
                      <MessageSquare className="size-3.5" />
                      Live Chat
                      {chatMessages.length > 0 && (
                        <Badge variant="default" className="size-4 p-0 text-[10px] flex items-center justify-center font-bold">
                          {chatMessages.length}
                        </Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="participants" className="gap-2 rounded-md text-xs font-medium py-1.5">
                      <Users className="size-3.5" />
                      Participants
                      <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-semibold">
                        {participants.length}
                      </Badge>
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="chat" className="flex-1 flex flex-col justify-between overflow-hidden mt-0">
                  <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                    {chatMessages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground py-16 gap-2">
                        <div className="size-12 rounded-xl bg-muted flex items-center justify-center">
                          <MessageSquare className="size-6 opacity-40" />
                        </div>
                        <p className="text-xs font-medium">No chat messages yet</p>
                        <p className="text-[11px] text-muted-foreground">Be the first to say hello!</p>
                      </div>
                    ) : (
                      chatMessages.map((msg, index) => {
                        const isMe = msg.userId === userId;
                        return (
                          <div
                            key={msg.id || index}
                            className={`flex flex-col gap-1 ${isMe ? "items-end" : "items-start"}`}
                          >
                            <div className="flex items-center gap-1.5 text-[11px]">
                              <span className={`font-semibold ${isMe ? "text-primary" : "text-foreground"}`}>
                                {msg.username}
                              </span>
                              {msg.role === "host" && (
                                <Crown className="size-3 text-primary fill-current" />
                              )}
                              {msg.role === "moderator" && (
                                <Shield className="size-3 text-muted-foreground" />
                              )}
                              <span className="text-[10px] text-muted-foreground">
                                {msg.createdAt
                                  ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                  : ""}
                              </span>
                            </div>

                            <div
                              className={`px-3 py-2 rounded-lg text-xs max-w-[85%] break-words shadow-sm leading-relaxed ${isMe
                                ? "bg-primary text-primary-foreground rounded-tr-none font-medium"
                                : "bg-muted text-foreground border border-border rounded-tl-none"
                                }`}
                            >
                              {msg.message}
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={chatBottomRef} />
                  </div>

                  <form onSubmit={handleSendChat} className="p-3 border-t border-border flex items-center gap-2">
                    <Input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 text-xs h-10 rounded-lg bg-background"
                    />
                    <Button
                      type="submit"
                      size="icon"
                      variant="default"
                      disabled={!chatInput.trim()}
                      className="size-10 rounded-lg shrink-0"
                    >
                      <Send className="size-4" />
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="participants" className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 mt-0">
                  <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-1">
                    <span>Connected Viewers</span>
                    <Badge variant="outline" className="text-[10px]">
                      {participants.length} Active
                    </Badge>
                  </div>

                  {participants.map((user) => {
                    const isMe = user.userId === userId;
                    const isRoomHost = myRole === "host";

                    return (
                      <Card
                        key={user.userId}
                        className="border-border bg-card hover:border-ring transition-colors shadow-none py-0"
                      >
                        <CardContent className="p-3 flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar className="size-8">
                              <AvatarFallback className="text-xs font-semibold bg-muted text-foreground">
                                {user.username ? user.username.charAt(0).toUpperCase() : "U"}
                              </AvatarFallback>
                            </Avatar>

                            <div className="min-w-0 flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="text-xs font-semibold truncate">
                                  {user.username}
                                </span>
                                {isMe && (
                                  <Badge variant="outline" className="text-[10px] py-0 px-1 text-muted-foreground">
                                    You
                                  </Badge>
                                )}
                              </div>
                              <div>{renderRoleBadge(user.role)}</div>
                            </div>
                          </div>

                          {isRoomHost && !isMe && (
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    className="size-7 rounded-md"
                                  />
                                }
                              >
                                <MoreVertical className="size-3.5 text-muted-foreground" />
                              </DropdownMenuTrigger>

                              <DropdownMenuContent align="end" className="w-52">
                                <DropdownMenuLabel>Manage Viewer</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuGroup>
                                  {user.role === "participant" ? (
                                    <DropdownMenuItem
                                      onClick={() => handleAssignRole(user.userId, "moderator")}
                                      className="gap-2 cursor-pointer"
                                    >
                                      <Shield className="size-4" />
                                      Promote to Moderator
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem
                                      onClick={() => handleAssignRole(user.userId, "participant")}
                                      className="gap-2 cursor-pointer"
                                    >
                                      <UserCheck className="size-4" />
                                      Demote to Participant
                                    </DropdownMenuItem>
                                  )}

                                  <DropdownMenuItem
                                    onClick={() => handleTransferHost(user.userId)}
                                    className="gap-2 cursor-pointer"
                                  >
                                    <Crown className="size-4" />
                                    Transfer Host Role
                                  </DropdownMenuItem>
                                </DropdownMenuGroup>

                                <DropdownMenuSeparator />

                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => handleRemoveParticipant(user.userId)}
                                  className="gap-2 cursor-pointer"
                                >
                                  <UserX className="size-4" />
                                  Remove from Room
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        )}
      </main>

      <Dialog open={showChangeVideoModal} onOpenChange={setShowChangeVideoModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Video className="size-5 text-primary" />
              Change YouTube Video
            </DialogTitle>
            <DialogDescription>
              Enter any YouTube video link or video ID. The video will change in sync for everyone in the room.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleChangeVideoSubmit} className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="change-video-url">Video Link or ID</FieldLabel>
                <Input
                  id="change-video-url"
                  type="text"
                  value={newVideoInput}
                  onChange={(e) => setNewVideoInput(e.target.value)}
                  placeholder="e.g. https://www.youtube.com/watch?v=..."
                  required
                  autoFocus
                  className="rounded-lg h-10"
                />
              </Field>
            </FieldGroup>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowChangeVideoModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="default"
                className="font-medium"
              >
                Update Video
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showJoinDialog}
        onOpenChange={(open) => {
          if (!open && !hasJoined) {
            router.push("/");
          }
        }}
      >
        <DialogContent
          className="sm:max-w-md"
          onPointerDownOutside={(e) => {
            e.preventDefault();
          }}
        >
          <form onSubmit={handleDirectJoinSubmit} className="space-y-4">
            <DialogHeader>
              <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-2">
                <Users className="size-5" />
              </div>
              <DialogTitle className="text-xl">Join Watch Party</DialogTitle>
              <DialogDescription>
                You are joining room{" "}
                <span className="font-mono font-semibold text-foreground">{roomId}</span>.
                Enter your name to join the party.
              </DialogDescription>
            </DialogHeader>

            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="direct-join-name">Your Display Name</FieldLabel>
                <Input
                  id="direct-join-name"
                  placeholder="e.g. Alex"
                  value={joinNameInput}
                  onChange={(e) => {
                    setJoinNameInput(e.target.value);
                    if (joinError) setJoinError("");
                  }}
                  autoFocus
                />
              </Field>
            </FieldGroup>

            {joinError && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>Name Required</AlertTitle>
                <AlertDescription>{joinError}</AlertDescription>
              </Alert>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push("/")}
              >
                Cancel
              </Button>
              <Button type="submit" variant="default" className="font-medium">
                Join Room
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function RoomPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      }
    >
      <RoomContent />
    </Suspense>
  );
}
