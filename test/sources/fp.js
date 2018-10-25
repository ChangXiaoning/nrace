(function(){
    var x, v;
    setTimeout(function(){
        x = 'init';
        var m = null;
        setTimeout(function(){
            v = 'hi';
            x = 'client';
            setTimeout(function(){
                console.log(x);
                if(v== 'hi')
                    console.log(v);
            }, 10);
        }, 0 )
    }, 0);
    setTimeout(function(){
         v = 'foo';
         console.log(v);
         x = null;
         v = 'final';
    }, 2);
})();

