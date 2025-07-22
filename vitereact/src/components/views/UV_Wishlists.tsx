import React, { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/store/main";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// --- Types (based on schema and backend spec) ---
type Wishlist = {
  wishlist_id: string;
  name: string;
  villa_ids: string[];
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
};

type VillaSummary = {
  villa_id: string;
  title: string;
  address_city: string;
  main_photo_url: string | null;
  price_per_night: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  is_active: boolean;
  is_instant_book: boolean;
  avg_rating: number;
  reviews_count: number;
};

// --- API Helpers ---
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

/** Fetch all wishlists for current user */
const fetchWishlists = async (token: string): Promise<Wishlist[]> => {
  const res = await axios.get(`${API_BASE}/account/wishlists`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  // Ensure villa_ids are string[]
  return (res.data as any[]).map((w) => ({
    ...w,
    wishlist_id: String(w.wishlist_id),
    villa_ids: Array.isArray(w.villa_ids) ? w.villa_ids.map((id: any) => String(id)) : [],
  }));
};

/** Fetch a villa summary (details) by id */
const fetchVilla = async (villa_id: string): Promise<VillaSummary> => {
  const res = await axios.get(`${API_BASE}/villa/${encodeURIComponent(villa_id)}`);
  const v = res.data;
  return {
    villa_id: String(v.villa_id),
    title: v.title,
    address_city: v.address_city,
    main_photo_url: v.main_photo_url || null,
    price_per_night: Number(v.price_per_night),
    bedrooms: v.bedrooms,
    beds: v.beds,
    bathrooms: v.bathrooms,
    is_active: v.is_active,
    is_instant_book: v.is_instant_book,
    avg_rating: Number(v.avg_rating),
    reviews_count: Number(v.reviews_count),
  };
};

/** Create a new wishlist */
const createWishlist = async ({ name, token }: { name: string; token: string }): Promise<Wishlist> => {
  const res = await axios.post(`${API_BASE}/account/wishlists`, { name }, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const w = res.data;
  return {
    ...w,
    wishlist_id: String(w.wishlist_id),
    villa_ids: Array.isArray(w.villa_ids) ? w.villa_ids.map((id: any) => String(id)) : [],
  };
};

/** Edit wishlist name */
const editWishlist = async ({
  wishlist_id,
  name,
  token,
}: {
  wishlist_id: string;
  name: string;
  token: string;
}): Promise<Wishlist> => {
  const res = await axios.patch(
    `${API_BASE}/account/wishlists/${encodeURIComponent(wishlist_id)}`,
    { name },
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  const w = res.data;
  return {
    ...w,
    wishlist_id: String(w.wishlist_id),
    villa_ids: Array.isArray(w.villa_ids) ? w.villa_ids.map((id: any) => String(id)) : [],
  };
};

/** Delete wishlist */
const deleteWishlist = async ({
  wishlist_id,
  token,
}: {
  wishlist_id: string;
  token: string;
}): Promise<Wishlist> => {
  const res = await axios.delete(`${API_BASE}/account/wishlists/${encodeURIComponent(wishlist_id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const w = res.data;
  return {
    ...w,
    wishlist_id: String(w.wishlist_id),
    villa_ids: Array.isArray(w.villa_ids) ? w.villa_ids.map((id: any) => String(id)) : [],
  };
};

/** Remove villa from wishlist */
const removeVillaFromWishlist = async ({
  wishlist_id,
  villa_id,
  token,
}: {
  wishlist_id: string;
  villa_id: string;
  token: string;
}): Promise<Wishlist> => {
  const res = await axios.delete(
    `${API_BASE}/account/wishlists/${encodeURIComponent(wishlist_id)}/villas/${encodeURIComponent(villa_id)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  const w = res.data;
  return {
    ...w,
    wishlist_id: String(w.wishlist_id),
    villa_ids: Array.isArray(w.villa_ids) ? w.villa_ids.map((id: any) => String(id)) : [],
  };
};

// ---- Error Boundary Fallback ----
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div className="max-w-2xl mx-auto p-6 my-12 rounded-lg bg-red-100 text-red-800 border border-red-300 shadow">
    <div className="font-bold text-lg mb-2">An error occurred loading your wishlists.</div>
    <div className="mb-2">{error.message}</div>
    <Link
      className="text-blue-700 underline"
      to="/"
    >
      Back to homepage
    </Link>
  </div>
);

/* ----------- Main UV_Wishlists Component ----------- */
const UV_Wishlists: React.FC = () => {
  // 1. Auth: Enforce authenticated guests only
  const user_session = useAppStore((state) => state.user_session);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user_session.is_authenticated) {
      navigate("/guest/login");
    }
  }, [user_session.is_authenticated, navigate]);

  // 2. Zustand global state (for cache/optimistic updates)
  const wishlist_state = useAppStore((state) => state.wishlist_state);
  const set_wishlist_state = useAppStore((state) => state.set_wishlist_state);

  // 3. Modal/local states
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState<null | string>(null); // wishlist_id being edited
  const [deleteOpen, setDeleteOpen] = useState<null | string>(null); // wishlist_id being deleted
  const [wishlistNameInput, setWishlistNameInput] = useState<string>(""); // for create/edit
  const [actionWishListId, setActionWishListId] = useState<null | string>(null); // for remove villa loading
  const [actionVillaId, setActionVillaId] = useState<null | string>(null); // for remove villa

  // 4. React Query
  const queryClient = useQueryClient();

  // --- Fetch Wishlists ---
  const {
    data: wishlists,
    isLoading: loadingWishlists,
    isError: isWishlistsError,
    error: wishlistsError,
    refetch: refetchWishlists,
  } = useQuery<Wishlist[], Error>({
    queryKey: ["wishlists", user_session.user_id],
    enabled: !!user_session.token,
    queryFn: () => fetchWishlists(user_session.token!),
    onSuccess: (data) => {
      if (set_wishlist_state) set_wishlist_state({ wishlists: data });
    },
  });

  // --- Collect all unique villa_ids ---
  const allVillaIds: string[] = useMemo(() => {
    if (!wishlists) return [];
    const ids = wishlists
      .filter((wl) => !wl.is_deleted)
      .flatMap((wl) => wl.villa_ids || [])
      .map((id) => String(id));
    return Array.from(new Set(ids));
  }, [wishlists]);

  // --- Fetch all villas in wishlists (separately, parallelized, using react-query for each) ---
  const villaQueries = useMemo(
    () =>
      allVillaIds.map((villa_id) =>
        useQuery<VillaSummary, Error>({
          queryKey: ["villa", villa_id],
          enabled: !!villa_id,
          queryFn: () => fetchVilla(villa_id),
        })
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allVillaIds.join(".")] // to avoid duplicate queries on same set
  );
  // Build lookup: villa_id -> summary
  const villaLookup: Record<string, VillaSummary> = {};
  villaQueries.forEach((vq, i) => {
    if (vq.data) {
      villaLookup[allVillaIds[i]] = vq.data;
    }
  });
  const loadingAnyVilla = villaQueries.some((q) => q.isLoading);

  // --- Mutations ---
  const createWishlistMutation = useMutation<
    Wishlist,
    Error,
    { name: string; token: string }
  >({
    mutationFn: createWishlist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlists", user_session.user_id] });
      setCreateOpen(false);
      setWishlistNameInput("");
    },
  });

  const editWishlistMutation = useMutation<
    Wishlist,
    Error,
    { wishlist_id: string; name: string; token: string }
  >({
    mutationFn: editWishlist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlists", user_session.user_id] });
      setEditOpen(null);
      setWishlistNameInput("");
    },
  });

  const deleteWishlistMutation = useMutation<
    Wishlist,
    Error,
    { wishlist_id: string; token: string }
  >({
    mutationFn: deleteWishlist,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlists", user_session.user_id] });
      setDeleteOpen(null);
    },
  });

  const removeVillaMutation = useMutation<
    Wishlist,
    Error,
    { wishlist_id: string; villa_id: string; token: string }
  >({
    mutationFn: removeVillaFromWishlist,
    onMutate: ({ wishlist_id, villa_id }) => {
      setActionWishListId(wishlist_id);
      setActionVillaId(villa_id);
    },
    onSettled: () => {
      setActionWishListId(null);
      setActionVillaId(null);
      queryClient.invalidateQueries({ queryKey: ["wishlists", user_session.user_id] });
    },
  });

  // --- Error catcher boundary ---
  const [errorBoundaryError, setErrorBoundaryError] = useState<Error | null>(null);

  // --- Main render ---

  // Filter active (not deleted) wishlists for display
  const displayedWishlists = (wishlists || []).filter((wl) => !wl.is_deleted);

  return (
    <>
      {/* Error Boundary */}
      {errorBoundaryError && <ErrorFallback error={errorBoundaryError} />}

      {/* Page Header */}
      <div className="max-w-3xl mx-auto py-8 px-4 flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-gray-900">Your Wishlists</h1>
        <button
          className="bg-blue-600 text-white rounded-md px-4 py-2 font-semibold hover:bg-blue-700 transition"
          onClick={() => {
            setCreateOpen(true);
            setWishlistNameInput("");
          }}
        >
          + New Wishlist
        </button>
      </div>

      {/* Empty state */}
      {!loadingWishlists && displayedWishlists.length === 0 && (
        <div className="w-full flex flex-col items-center justify-center mt-20">
          <div className="text-4xl mb-4">💡</div>
          <div className="text-xl mb-2 font-semibold">No wishlists yet!</div>
          <div className="text-gray-500 mb-4">
            Start collecting villas for your next dreamy beach trip.
          </div>
          <button
            className="bg-blue-700 rounded-lg px-5 py-2 text-white font-semibold shadow hover:bg-blue-800"
            onClick={() => setCreateOpen(true)}
          >
            Create Your First Wishlist
          </button>
        </div>
      )}

      {/* Wishlists Section */}
      <div className="max-w-5xl mx-auto px-4 grid grid-cols-1 gap-8 md:grid-cols-2 mt-8">
        {loadingWishlists ? (
          <div className="col-span-full flex items-center justify-center py-12">
            <span className="animate-spin mr-2">⏳</span>
            <span className="text-gray-600">Loading wishlists...</span>
          </div>
        ) : isWishlistsError ? (
          <ErrorFallback error={wishlistsError as Error} />
        ) : (
          displayedWishlists.map((wishlist) => (
            <div
              key={wishlist.wishlist_id}
              className="bg-white border border-gray-200 rounded-lg shadow-lg pb-2"
            >
              {/* Wishlist Card - Header */}
              <div className="flex items-center justify-between gap-2 px-5 pt-5 pb-2 border-b">
                <div className="font-bold text-xl truncate">
                  {wishlist.name}
                </div>
                <div className="flex flex-row items-center gap-3">
                  <button
                    aria-label="Rename Wishlist"
                    onClick={() => {
                      setEditOpen(wishlist.wishlist_id);
                      setWishlistNameInput(wishlist.name);
                    }}
                    className="bg-stone-100 hover:bg-stone-200 rounded px-2 py-1 text-gray-700"
                  >
                    Rename
                  </button>
                  <button
                    aria-label="Delete Wishlist"
                    onClick={() => setDeleteOpen(wishlist.wishlist_id)}
                    className="bg-red-100 hover:bg-red-200 rounded px-2 py-1 text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
              {/* Wishlist Card - Villas */}
              <div className="p-5">
                {wishlist.villa_ids.length === 0 ? (
                  <div className="italic text-gray-400 text-center">Empty – Add villas to your wishlist from any villa page.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {wishlist.villa_ids.map((villa_id) => {
                      const vid = String(villa_id);
                      const villa = villaLookup[vid];
                      const idx = allVillaIds.findIndex((id) => id === vid);
                      const villaLoading = idx !== -1 ? villaQueries[idx]?.isLoading : false;
                      return (
                        <div
                          key={vid}
                          className="relative flex flex-col border border-gray-100 rounded-lg shadow hover:shadow-md bg-gray-50"
                        >
                          {villaLoading && (
                            <div className="flex flex-col items-center justify-center min-h-[140px] bg-gray-100 rounded animate-pulse">
                              <div className="w-full h-24 rounded bg-gray-200 mb-2" />
                              <div className="h-4 bg-gray-200 w-2/3 rounded mb-1" />
                              <div className="h-3 bg-gray-200 w-1/2 rounded" />
                            </div>
                          )}
                          {!villaLoading && villa && (
                            <>
                              <Link
                                to={`/villa/${villa.villa_id}`}
                                className="group"
                              >
                                <div className="w-full h-36 rounded-t-lg overflow-hidden bg-stone-200">
                                  {villa.main_photo_url ? (
                                    <img
                                      src={villa.main_photo_url}
                                      alt={villa.title}
                                      className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-200"
                                    />
                                  ) : (
                                    <div className="flex items-center justify-center w-full h-full bg-gray-200 text-gray-400 text-2xl">🏖️</div>
                                  )}
                                </div>
                                <div className="px-3 py-2 flex flex-col">
                                  <div className="font-bold text-md truncate">
                                    {villa.title}
                                  </div>
                                  <div className="text-sm text-gray-600 truncate">
                                    {villa.address_city}
                                  </div>
                                  <div className="flex flex-row items-center space-x-1 text-xs text-gray-500 mt-1">
                                    <span>{villa.bedrooms} bd</span>
                                    <span>·</span>
                                    <span>{villa.beds} beds</span>
                                    <span>·</span>
                                    <span>{villa.bathrooms} ba</span>
                                  </div>
                                  <div className="flex items-center mt-1 space-x-2">
                                    <span className="text-blue-800 font-semibold">
                                      ${villa.price_per_night}/night
                                    </span>
                                    {villa.is_instant_book && (
                                      <span className="text-green-700 text-xs font-medium px-2 py-0.5 bg-green-100 rounded">Instant Book</span>
                                    )}
                                  </div>
                                  <div className="flex items-center space-x-2 text-xs text-yellow-600">
                                    <span>⭐ {(villa.avg_rating || 0).toFixed(2)}</span>
                                    <span>({villa.reviews_count} reviews)</span>
                                  </div>
                                </div>
                              </Link>
                              {/* Remove villa from wishlist */}
                              <button
                                onClick={() => 
                                  removeVillaMutation.mutate({
                                    wishlist_id: String(wishlist.wishlist_id),
                                    villa_id: String(villa.villa_id),
                                    token: user_session.token!,
                                  })
                                }
                                aria-label="Remove villa from wishlist"
                                disabled={
                                  removeVillaMutation.isLoading &&
                                  actionWishListId === String(wishlist.wishlist_id) &&
                                  actionVillaId === String(villa.villa_id)
                                }
                                className={`absolute top-2 right-2 bg-white border border-red-300 hover:bg-red-100 text-red-600 px-2 py-1 rounded text-xs z-10 ${
                                  removeVillaMutation.isLoading &&
                                  actionWishListId === String(wishlist.wishlist_id) &&
                                  actionVillaId === String(villa.villa_id)
                                    ? "opacity-60 pointer-events-none"
                                    : ""
                                }`}
                              >
                                {removeVillaMutation.isLoading &&
                                actionWishListId === String(wishlist.wishlist_id) &&
                                actionVillaId === String(villa.villa_id) ? (
                                  <span className="animate-spin">⏳</span>
                                ) : (
                                  "Remove"
                                )}
                              </button>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* --- Modal: Create Wishlist --- */}
      {createOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full relative">
            <button
              className="absolute right-2 top-2 text-gray-500 hover:text-gray-700"
              onClick={() => setCreateOpen(false)}
              aria-label="Close"
            >
              ×
            </button>
            <h2 className="text-lg font-bold mb-4">Create New Wishlist</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (wishlistNameInput.trim().length < 2) return;
                createWishlistMutation.mutate({
                  name: wishlistNameInput.trim(),
                  token: user_session.token!,
                });
              }}
            >
              <input
                className="border rounded px-3 py-2 w-full mb-3 outline-blue-500"
                value={wishlistNameInput}
                onChange={(e) => setWishlistNameInput(e.target.value)}
                minLength={2}
                maxLength={255}
                placeholder="Wishlist name"
                required
              />
              <button
                type="submit"
                className="bg-blue-700 text-white px-4 py-2 rounded w-full font-semibold hover:bg-blue-800 transition"
                disabled={createWishlistMutation.isLoading}
              >
                {createWishlistMutation.isLoading ? "Creating..." : "Create"}
              </button>
              {createWishlistMutation.error && (
                <div className="text-red-500 mt-2 text-sm">{createWishlistMutation.error.message}</div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* --- Modal: Edit Wishlist --- */}
      {editOpen !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full relative">
            <button
              className="absolute right-2 top-2 text-gray-500 hover:text-gray-700"
              onClick={() => {
                setEditOpen(null);
                setWishlistNameInput("");
              }}
              aria-label="Close"
            >
              ×
            </button>
            <h2 className="text-lg font-bold mb-4">Rename Wishlist</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (wishlistNameInput.trim().length < 2) return;
                editWishlistMutation.mutate({
                  wishlist_id: String(editOpen!),
                  name: wishlistNameInput.trim(),
                  token: user_session.token!,
                });
              }}
            >
              <input
                className="border rounded px-3 py-2 w-full mb-3 outline-blue-500"
                value={wishlistNameInput}
                onChange={(e) => setWishlistNameInput(e.target.value)}
                minLength={2}
                maxLength={255}
                placeholder="Wishlist name"
                required
              />
              <button
                type="submit"
                className="bg-blue-700 text-white px-4 py-2 rounded w-full font-semibold hover:bg-blue-800 transition"
                disabled={editWishlistMutation.isLoading}
              >
                {editWishlistMutation.isLoading ? "Saving..." : "Save"}
              </button>
              {editWishlistMutation.error && (
                <div className="text-red-500 mt-2 text-sm">{editWishlistMutation.error.message}</div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* --- Modal: Delete Wishlist --- */}
      {deleteOpen !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full relative">
            <button
              className="absolute right-2 top-2 text-gray-500 hover:text-gray-700"
              onClick={() => setDeleteOpen(null)}
              aria-label="Close"
            >
              ×
            </button>
            <h2 className="text-lg font-bold mb-4">Delete Wishlist?</h2>
            <p className="mb-4 text-gray-700">
              Are you sure you want to delete this wishlist? This will remove it for you, but will not affect any villas.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => 
                  deleteWishlistMutation.mutate({
                    wishlist_id: String(deleteOpen!),
                    token: user_session.token!,
                  })
                }
                className="bg-red-700 text-white px-4 py-2 rounded font-semibold hover:bg-red-800 transition"
                disabled={deleteWishlistMutation.isLoading}
              >
                {deleteWishlistMutation.isLoading ? "Deleting..." : "Delete"}
              </button>
              <button
                onClick={() => setDeleteOpen(null)}
                className="bg-gray-200 px-4 py-2 rounded font-semibold hover:bg-gray-300 transition"
              >
                Cancel
              </button>
            </div>
            {deleteWishlistMutation.error && (
              <div className="text-red-500 mt-2 text-sm">{deleteWishlistMutation.error.message}</div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default UV_Wishlists;