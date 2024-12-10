return {
  {
    "vhyrro/luarocks.nvim",
    priority = 1001, -- this plugin needs to run before anything else
    opts = {
      rocks = { "magick" },
    },
    config = true,
  },
  {
    "3rd/image.nvim",
    dependencies = { "luarocks.nvim" },
    opts = {
      max_width = 200, -- tweak to preference
      max_height = 24, -- ^
      max_height_window_percentage = math.huge, -- this is necessary for a good experience
      max_width_window_percentage = math.huge,
      window_overlap_clear_enabled = true,
      window_overlap_clear_ft_ignore = { "cmp_menu", "cmp_docs", "" },
    },
  },
}
