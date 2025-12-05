"use client";

import Modal from "@/app/components/Modal";
import { useState, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import Image from "next/image";

interface GifModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
}

interface GifItem {
  id: string;
  images: {
    fixed_height: {
      url: string;
      width: string;
      height: string;
    };
    downsized: {
      url: string;
    };
  };
  title: string;
}

const GifModal: React.FC<GifModalProps> = ({
  isOpen,
  onClose,
  conversationId,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [gifs, setGifs] = useState<GifItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Load trending GIFs on mount
  useEffect(() => {
    if (isOpen && gifs.length === 0) {
      loadTrendingGifs();
    }
  }, [isOpen]);

  const loadTrendingGifs = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/giphy/trending?limit=20`
      );
      const data = await response.json();
      
      if (data.error) {
        console.error("Giphy API error:", data.error);
        setGifs([]);
        toast.error(data.error);
      } else {
        setGifs(data.data || []);
      }
    } catch (error) {
      console.error("Failed to load GIFs:", error);
      setGifs([]);
      toast.error("Failed to load GIFs");
    } finally {
      setIsLoading(false);
    }
  };

  const searchGifs = async () => {
    if (!searchQuery.trim()) {
      loadTrendingGifs();
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/giphy/search?q=${encodeURIComponent(searchQuery)}&limit=20`
      );
      const data = await response.json();
      
      if (data.error) {
        console.error("Giphy API error:", data.error);
        setGifs([]);
        toast.error(data.error);
      } else {
        setGifs(data.data || []);
      }
    } catch (error) {
      console.error("Failed to search GIFs:", error);
      toast.error("Failed to search GIFs");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGifClick = async (gifUrl: string) => {
    setIsSending(true);

    try {
      await axios.post("/api/messages", {
        image: gifUrl,
        conversationId,
      });

      onClose();
      toast.success("GIF sent!");
    } catch (error) {
      console.error("GIF send error:", error);
      toast.error("Failed to send GIF");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Choose a GIF</h3>
          <p className="text-sm text-gray-500 mt-1">
            Search for the perfect GIF
          </p>
        </div>

        {/* Search Bar */}
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                searchGifs();
              }
            }}
            placeholder="Search GIFs..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <button
            onClick={searchGifs}
            disabled={isLoading}
            className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg transition disabled:opacity-50"
          >
            Search
          </button>
        </div>

        {/* GIF Grid */}
        <div className="grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto p-2">
          {isLoading ? (
            <div className="col-span-2 text-center py-8 text-gray-500">
              Loading GIFs...
            </div>
          ) : gifs.length === 0 ? (
            <div className="col-span-2 text-center py-8 text-gray-500">
              <p>No GIFs found</p>
              <p className="text-sm mt-2">
                Try searching for something else
              </p>
            </div>
          ) : (
            gifs.map((gif) => (
              <button
                key={gif.id}
                onClick={() => handleGifClick(gif.images.downsized.url)}
                disabled={isSending}
                className="relative aspect-square rounded-lg overflow-hidden hover:ring-2 hover:ring-sky-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Image
                  src={gif.images.fixed_height.url}
                  alt={gif.title}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </button>
            ))
          )}
        </div>

        {/* Close Button */}
        <div className="flex justify-end pt-4 border-t">
          <button
            onClick={onClose}
            disabled={isSending}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition disabled:opacity-50"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default GifModal;
