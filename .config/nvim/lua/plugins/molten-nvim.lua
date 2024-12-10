return {
  {
    "benlubas/molten-nvim",
    version = "^1.0.0", -- use version <2.0.0 to avoid breaking changes
    dependencies = { "3rd/image.nvim" },
    build = ":UpdateRemotePlugins",
    init = function()
      -- these are examples, not defaults. Please see the readme
      vim.g.molten_image_provider = "image.nvim"
      vim.g.molten_output_win_max_height = 20
      vim.g.molten_image_location = "float"
      vim.g.molten_output_virt_lines = true
      vim.g.molten_output_crop_border = false
      vim.g.molten_enter_output_behavior = "open_and_enter"
      vim.g.molten_virt_lines_off_by_1 = false
      vim.g.molten_output_win_border = { "", "", "", "" }
      vim.keymap.set("n", "<leader>mi", ":MoltenInit<CR>", { silent = true, desc = "Initialize the plugin" })
      vim.keymap.set(
        "n",
        "<leader>mo",
        ":MoltenEvaluateOperator<CR>",
        { silent = true, desc = "run operator selection" }
      )
      vim.keymap.set("n", "<leader>ml", ":MoltenEvaluateLine<CR>", { silent = true, desc = "evaluate line" })
      vim.keymap.set("n", "<leader>mc", ":MoltenReevaluateCell<CR>", { silent = true, desc = "re-evaluate cell" })
      vim.keymap.set(
        "v",
        "<leader>mv",
        ":<C-u>MoltenEvaluateVisual<CR>gv",
        { silent = true, desc = "evaluate visual selection" }
      )
      vim.keymap.set("n", "<leader>md", ":MoltenDelete<CR>", { silent = true, desc = "molten delete cell" })
      vim.keymap.set("n", "<leader>mh", ":MoltenHideOutput<CR>", { silent = true, desc = "hide output" })
      vim.keymap.set(
        "n",
        "<leader>ms",
        ":noautocmd MoltenEnterOutput<CR>",
        { silent = true, desc = "show/enter output" }
      )
      vim.keymap.set("n", "<leader>mR", ":MoltenRestart!<CR>", { silent = true, desc = "restart kernel" })
    end,
  },
}
