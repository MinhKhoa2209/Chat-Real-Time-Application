"use client";

import clsx from "clsx";
import EmptyState from "../components/EmptyState";
import useConversation from "../hooks/useConversation";

const Home = () => {
    const {isOpen} = useConversation();
    return(
        // <div className={clsx("lg:pl-80 h-full lg:blocl", isOpen? 'block' : 'hidden')}>
        <div className={clsx("lg:pl-80 h-full", isOpen ? "block" : "block")}>
            <EmptyState/>
        </div>
    )
}
export default Home;