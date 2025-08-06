return {
  {
    "echasnovski/mini.pairs",
    event = "VeryLazy",
    opts = function(_, opts)
      return opts
    end,
    config = function(_, opts)
      require("mini.pairs").setup(opts)

      -- Python-specific triple quote pairing
      vim.api.nvim_create_autocmd("FileType", {
        pattern = "python",
        callback = function(ev)
          vim.keymap.set("i", '"""', function()
            local line = vim.api.nvim_get_current_line()
            local col = vim.api.nvim_win_get_cursor(0)[2]
            local before = line:sub(1, col)

            if before:match('""$') then
              return '"<C-g>U<Left><Left><Left>'
            else
              return '""""""<C-g>U<Left><Left><Left>'
            end
          end, { expr = true, buffer = ev.buf, desc = "Smart triple quotes" })
        end,
      })
    end,
  },
}
