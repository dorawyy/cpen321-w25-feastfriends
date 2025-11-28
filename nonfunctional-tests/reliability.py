"""
System must be up 90% of the time
"""

import serverLive

"""
we can amortize the running of the server 
by running this request at the end of the process
this is just secondary verification 
main motivation for the "passing" of this nfr
is AWS being live 

That being said most erronious behavour occurs
during the initial boot of our instance; thus 
we can assert that if the server remains to be live
those errors are likely to be gone
 
"""

if __file__ == "__main__":
    assert(serverLive.confirmConnection())
