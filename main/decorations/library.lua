-- #705: where each decoration preset sits in the editor library's Decor tab (world and category).
-- Hand-written next to the generated assets.lua, so the art generator and its manifest stay unchanged.
-- tests/bootstrap/test_decoration_library.py checks that every preset and fence has a tag.
return {
    WORLDS={{id='meadow',name='Meadow'}},
    CATEGORIES={{id='trees',name='Trees',icon='tree'},{id='plants',name='Plants',icon='flower'},{id='rocks',name='Rocks',icon='rock'},
        {id='props',name='Props',icon='sign'},{id='fences',name='Fences',icon='fence'}},
    TAGS={
        ['tree-oak']={world='meadow',category='trees'},
        ['tree-pine']={world='meadow',category='trees'},
        ['stump']={world='meadow',category='trees'},
        ['bush-round']={world='meadow',category='plants'},
        ['bush-berry']={world='meadow',category='plants'},
        ['grass-tuft']={world='meadow',category='plants'},
        ['grass-tall']={world='meadow',category='plants'},
        ['flowers']={world='meadow',category='plants'},
        ['mushrooms']={world='meadow',category='plants'},
        ['rock-large']={world='meadow',category='rocks'},
        ['rock-small']={world='meadow',category='rocks'},
        ['sign']={world='meadow',category='props'},
        ['cone']={world='meadow',category='props'},
        ['fence-wood']={world='meadow',category='fences'},
    },
}
