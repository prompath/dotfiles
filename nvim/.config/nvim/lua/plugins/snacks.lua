return {
  {
    "folke/snacks.nvim",
    opts = {
      picker = {
        sources = {
          -- show dotfiles by default, toggle with H (explorer) or <a-h> (files)
          explorer = { hidden = true },
          files = { hidden = true },
        },
      },
    },
  },
}
