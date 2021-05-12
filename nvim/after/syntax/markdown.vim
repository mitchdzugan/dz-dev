"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
"""" CONCEAL """"""""""""""""""""""""""""""""""""""""""""""""""""""""""""""

" syntax off

syntax match todoTag "\[ \]" conceal cchar=☐
syntax match todoTag "\[X\]" conceal cchar=☑
hi link todoTag Operator
" hi! link Conceal Operator
setlocal conceallevel=2
set concealcursor=nc


if exists('*EnableSyntax')
    finish
endif
function! EnableSyntax(a) abort
  syntax on
endfunction
let Fref = function('EnableSyntax', [])
call timer_start(0, Fref)
